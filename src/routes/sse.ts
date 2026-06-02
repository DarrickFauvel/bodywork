import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { requireAdmin } from "../auth/middleware"
import { query } from "../db/client"
import { patchElements, patchSignals } from "../lib/html"
import { lineItemRow, totalsRow } from "../views/partials"
import { generateToken } from "../lib/tokens"
import type { Estimate, Invoice, LineItem, Settings } from "../types"

const app = new Hono()
app.use("*", requireAdmin)

async function getItems(estimateId: string | null, invoiceId: string | null): Promise<LineItem[]> {
  const id = estimateId ?? invoiceId
  const col = estimateId ? "estimateId" : "invoiceId"
  const rows = await query(
    `SELECT * FROM line_items WHERE ${col} = ? ORDER BY sortOrder ASC, createdAt ASC`,
    [id!]
  )
  return rows.rows as unknown as LineItem[]
}

async function getSettings(): Promise<Settings> {
  const row = await query("SELECT * FROM settings WHERE id = 'singleton'")
  return (row.rows[0] ?? { defaultLaborRate: 95, defaultTaxRate: 0 }) as unknown as Settings
}

// Datastar v1.0.1 lowercases all signal names before sending, so normalize keys here
async function parseSignals(c: { req: { json: <T>() => Promise<T>; parseBody: () => Promise<Record<string, unknown>> } }): Promise<Record<string, string>> {
  const raw = await (c.req.json<Record<string, unknown>>() as Promise<Record<string, unknown>>).catch(async () => {
    return c.req.parseBody() as Promise<Record<string, unknown>>
  })
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), String(v ?? "")])
  )
}

// ── Estimate: Save Header ──────────────────────────────────────────────────
app.post("/estimates/:id/save", async (c) => {
  const { id } = c.req.param()
  const data = await parseSignals(c)
  const taxRate = parseFloat(data.taxrate ?? "0") / 100
  const vehicle = JSON.stringify({
    year: data.vyear || "", make: data.vmake || "", model: data.vmodel || "",
    color: data.vcolor || "", vin: data.vvin || "", mileage: data.vmileage || "",
  })
  await query(
    `UPDATE estimates SET title=?, vehicleInfo=?, notes=?, taxRate=?, updatedAt=? WHERE id=?`,
    [data.title || "", vehicle, data.notes || null, taxRate, Date.now(), id]
  )
  return streamSSE(c, async (stream) => {
    await stream.write(patchSignals({ toast: "Estimate saved." }))
  })
})

// ── Estimate: Status Transition ────────────────────────────────────────────
app.post("/estimates/:id/status", async (c) => {
  const { id } = c.req.param()
  const action = c.req.query("action")
  const now = Date.now()

  if (action === "send") {
    const token = generateToken()
    await query(`UPDATE estimates SET status='sent', shareToken=?, sentAt=?, updatedAt=? WHERE id=?`, [token, now, now, id])
  } else if (action === "approve") {
    await query(`UPDATE estimates SET status='approved', approvedAt=?, updatedAt=? WHERE id=?`, [now, now, id])
  } else if (action === "decline") {
    await query(`UPDATE estimates SET status='declined', declinedAt=?, updatedAt=? WHERE id=?`, [now, now, id])
  } else {
    return c.json({ error: "Unknown action" }, 400)
  }

  const row = await query("SELECT status FROM estimates WHERE id = ?", [id])
  const status = (row.rows[0] as Record<string, unknown>)?.status as string

  return streamSSE(c, async (stream) => {
    await stream.write(patchElements("#status-badge",
      `<span id="status-badge"><status-badge status="${status}"></status-badge></span>`))
    await stream.write(patchSignals({ toast: `Status updated to ${status}.` }))
  })
})

// ── Estimate: Convert to Invoice ───────────────────────────────────────────
app.post("/estimates/:id/convert", async (c) => {
  const { id } = c.req.param()
  const estRow = await query("SELECT * FROM estimates WHERE id = ?", [id])
  if (!estRow.rows[0]) return c.json({ error: "Not found" }, 404)
  const est = estRow.rows[0] as unknown as Estimate

  const invoiceId = crypto.randomUUID()
  const token = generateToken()
  const now = Date.now()

  await query(
    `INSERT INTO invoices (id, estimateId, customerId, status, title, vehicleInfo, notes, taxRate, shareToken, createdAt, updatedAt)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    [invoiceId, id, est.customerId, est.title, est.vehicleInfo, est.notes, est.taxRate, token, now, now]
  )

  const items = await getItems(id, null)
  for (const item of items) {
    await query(
      `INSERT INTO line_items (id, invoiceId, type, sortOrder, description, laborHours, laborRate, partNumber, quantity, unitPrice, flatPrice, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), invoiceId, item.type, item.sortOrder, item.description,
       item.laborHours, item.laborRate, item.partNumber, item.quantity, item.unitPrice, item.flatPrice, now, now]
    )
  }

  if (est.status === "sent") {
    await query(`UPDATE estimates SET status='approved', approvedAt=?, updatedAt=? WHERE id=?`, [now, now, id])
  }

  return streamSSE(c, async (stream) => {
    await stream.write(patchSignals({ redirect: `/admin/invoices/${invoiceId}` }))
  })
})

// ── Estimate: Add Line Item ────────────────────────────────────────────────
app.post("/estimates/:id/line-items", async (c) => {
  const { id } = c.req.param()
  const data = await parseSignals(c)
  const settings = await getSettings()
  const itemId = crypto.randomUUID()
  const now = Date.now()
  const type = data.newtype || "labor"

  await query(
    `INSERT INTO line_items (id, estimateId, type, sortOrder, description, laborHours, laborRate, partNumber, quantity, unitPrice, flatPrice, createdAt, updatedAt)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [itemId, id, type, data.newdesc || "—",
     type === "labor" ? parseFloat(data.newhours || "0") : null,
     type === "labor" ? parseFloat(data.newrate || String(settings.defaultLaborRate)) : null,
     (type === "parts" || type === "paint") ? (data.newpartnum || null) : null,
     (type === "parts" || type === "paint") ? parseFloat(data.newqty || "1") : null,
     (type === "parts" || type === "paint") ? parseFloat(data.newunitprice || "0") : null,
     type === "sublet" ? parseFloat(data.newflat || "0") : null,
     now, now]
  )

  const estRow = await query("SELECT taxRate FROM estimates WHERE id = ?", [id])
  const taxRate = (estRow.rows[0] as Record<string, unknown>)?.taxRate as number ?? 0
  const items = await getItems(id, null)
  const newItem = items.find((i) => i.id === itemId)!

  return streamSSE(c, async (stream) => {
    await stream.write(patchElements("#line-items-body", lineItemRow(newItem), "append"))
    await stream.write(patchElements("#totals-row", totalsRow(items, taxRate), "outer"))
  })
})

// ── Invoice: Save Header ───────────────────────────────────────────────────
app.post("/invoices/:id/save", async (c) => {
  const { id } = c.req.param()
  const data = await parseSignals(c)
  const taxRate = parseFloat(data.taxrate ?? "0") / 100
  const dueDate = data.duedate ? new Date(data.duedate).getTime() : null
  const vehicle = JSON.stringify({
    year: data.vyear || "", make: data.vmake || "", model: data.vmodel || "",
    color: data.vcolor || "", vin: data.vvin || "", mileage: data.vmileage || "",
  })
  await query(
    `UPDATE invoices SET title=?, vehicleInfo=?, notes=?, taxRate=?, dueDate=?, updatedAt=? WHERE id=?`,
    [data.title || "", vehicle, data.notes || null, taxRate, dueDate, Date.now(), id]
  )
  return streamSSE(c, async (stream) => {
    await stream.write(patchSignals({ toast: "Invoice saved." }))
  })
})

// ── Invoice: Status Transition ─────────────────────────────────────────────
app.post("/invoices/:id/status", async (c) => {
  const { id } = c.req.param()
  const action = c.req.query("action")
  const now = Date.now()

  if (action === "send") {
    const token = generateToken()
    await query(`UPDATE invoices SET status='sent', shareToken=?, sentAt=?, updatedAt=? WHERE id=?`, [token, now, now, id])
  } else if (action === "pay") {
    await query(`UPDATE invoices SET status='paid', paidAt=?, updatedAt=? WHERE id=?`, [now, now, id])
  } else {
    return c.json({ error: "Unknown action" }, 400)
  }

  const row = await query("SELECT status FROM invoices WHERE id = ?", [id])
  const status = (row.rows[0] as Record<string, unknown>)?.status as string

  return streamSSE(c, async (stream) => {
    await stream.write(patchElements("#status-badge",
      `<span id="status-badge"><status-badge status="${status}"></status-badge></span>`))
    await stream.write(patchSignals({ toast: `Status updated to ${status}.` }))
  })
})

// ── Invoice: Add Line Item ─────────────────────────────────────────────────
app.post("/invoices/:id/line-items", async (c) => {
  const { id } = c.req.param()
  const data = await parseSignals(c)
  const settings = await getSettings()
  const itemId = crypto.randomUUID()
  const now = Date.now()
  const type = data.newtype || "labor"

  await query(
    `INSERT INTO line_items (id, invoiceId, type, sortOrder, description, laborHours, laborRate, partNumber, quantity, unitPrice, flatPrice, createdAt, updatedAt)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [itemId, id, type, data.newdesc || "—",
     type === "labor" ? parseFloat(data.newhours || "0") : null,
     type === "labor" ? parseFloat(data.newrate || String(settings.defaultLaborRate)) : null,
     (type === "parts" || type === "paint") ? (data.newpartnum || null) : null,
     (type === "parts" || type === "paint") ? parseFloat(data.newqty || "1") : null,
     (type === "parts" || type === "paint") ? parseFloat(data.newunitprice || "0") : null,
     type === "sublet" ? parseFloat(data.newflat || "0") : null,
     now, now]
  )

  const invRow = await query("SELECT taxRate FROM invoices WHERE id = ?", [id])
  const taxRate = (invRow.rows[0] as Record<string, unknown>)?.taxRate as number ?? 0
  const items = await getItems(null, id)
  const newItem = items.find((i) => i.id === itemId)!

  return streamSSE(c, async (stream) => {
    await stream.write(patchElements("#line-items-body", lineItemRow(newItem), "append"))
    await stream.write(patchElements("#totals-row", totalsRow(items, taxRate), "outer"))
  })
})

// ── Line Item: Delete ──────────────────────────────────────────────────────
app.delete("/line-items/:id", async (c) => {
  const { id } = c.req.param()
  const row = await query("SELECT * FROM line_items WHERE id = ?", [id])
  if (!row.rows[0]) return c.json({ error: "Not found" }, 404)
  const item = row.rows[0] as unknown as LineItem

  await query("DELETE FROM line_items WHERE id = ?", [id])

  const estimateId = item.estimateId as string | null
  const invoiceId = item.invoiceId as string | null
  let taxRate = 0

  if (estimateId) {
    const r = await query("SELECT taxRate FROM estimates WHERE id = ?", [estimateId])
    taxRate = (r.rows[0] as Record<string, unknown>)?.taxRate as number ?? 0
  } else if (invoiceId) {
    const r = await query("SELECT taxRate FROM invoices WHERE id = ?", [invoiceId])
    taxRate = (r.rows[0] as Record<string, unknown>)?.taxRate as number ?? 0
  }

  const items = await getItems(estimateId, invoiceId)

  return streamSSE(c, async (stream) => {
    await stream.write(patchElements(`#line-item-${id}`, "", "remove"))
    await stream.write(patchElements("#totals-row", totalsRow(items, taxRate), "outer"))
  })
})

export { app as sseRoutes }
