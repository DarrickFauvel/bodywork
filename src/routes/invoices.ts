import { Hono } from "hono"
import { requireAdmin } from "../auth/middleware"
import { libsql, query } from "../db/client"
import { render } from "../views/renderer"
import { renderLayout } from "../views/layout-helper"
import { fmtDate } from "../lib/html"
import { lineItemRow, totalsRow } from "../views/partials"
import type { AppVariables, Customer, Invoice, InvoiceWithCustomer, LineItem, Settings } from "../types"

const app = new Hono<{ Variables: AppVariables }>()
app.use("*", requireAdmin)

app.get("/", async (c) => {
  const plan = c.get("plan") as string
  const activeTab = c.req.query("tab") ?? "all"
  const rows = await libsql.execute(
    `SELECT i.*, c.name AS customerName FROM invoices i
     JOIN customers c ON c.id = i.customerId
     ORDER BY i.createdAt DESC`
  )
  let invoices = rows.rows as unknown as InvoiceWithCustomer[]
  if (activeTab !== "all") invoices = invoices.filter((i) => i.status === activeTab)
  return c.html(await renderLayout(c, {
    title: "Invoices",
    activeNav: "invoices",
    content: await render("./invoices/list", { invoices, activeTab, fmtDate, plan }),
  }))
})

app.get("/new", async (c) => {
  const plan = c.get("plan") as string
  if (plan === "free") return c.redirect("/upgrade")
  const [custRows, settingsRow] = await Promise.all([
    libsql.execute("SELECT id, name FROM customers ORDER BY name ASC"),
    libsql.execute("SELECT * FROM settings WHERE id = 'singleton'"),
  ])
  return c.html(await renderLayout(c, {
    title: "New Invoice",
    activeNav: "invoices",
    content: await render("./invoices/form", {
      customers: custRows.rows,
      settings: settingsRow.rows[0] ?? {},
      prefillCustomerId: "", prefillTitle: "", prefillVehicle: null, fromEstimateId: null,
    }),
  }))
})

app.get("/:id", async (c) => {
  const { id } = c.req.param()
  const [invRow, custRow, itemRows, settingsRow] = await Promise.all([
    query("SELECT * FROM invoices WHERE id = ?", [id]),
    query("SELECT c.* FROM customers c JOIN invoices i ON i.customerId = c.id WHERE i.id = ?", [id]),
    query("SELECT * FROM line_items WHERE invoiceId = ? ORDER BY sortOrder ASC, createdAt ASC", [id]),
    libsql.execute("SELECT * FROM settings WHERE id = 'singleton'"),
  ])
  if (!invRow.rows[0]) return c.notFound()
  const invoice = invRow.rows[0] as unknown as Invoice
  const customer = custRow.rows[0] as unknown as Customer
  const items = itemRows.rows as unknown as LineItem[]
  const settings = (settingsRow.rows[0] ?? { defaultLaborRate: 95, defaultTaxRate: 0 }) as unknown as Settings
  const vehicle = invoice.vehicleInfo ? JSON.parse(invoice.vehicleInfo as string) : {}
  const shareUrl = invoice.shareToken
    ? `${process.env.ORIGIN ?? "http://localhost:3000"}/share/${invoice.shareToken}`
    : null

  return c.html(await renderLayout(c, {
    title: invoice.title,
    activeNav: "invoices",
    content: await render("./invoices/detail", {
      invoice, customer, vehicle, shareUrl, settings,
      lineItemsHtml: items.map(lineItemRow).join(""),
      totalsHtml: totalsRow(items, invoice.taxRate),
      fmtDate,
    }),
  }))
})

app.post("/", async (c) => {
  const plan = c.get("plan") as string
  if (plan === "free") return c.redirect("/upgrade")
  const body = await c.req.parseBody()
  const id = crypto.randomUUID()
  const now = Date.now()
  const taxRate = parseFloat(String(body.taxRate || "0")) / 100
  const dueDateStr = String(body.dueDate || "")
  const dueDate = dueDateStr ? new Date(dueDateStr).getTime() : null
  const vehicle = JSON.stringify({
    year: String(body.vYear || ""), make: String(body.vMake || ""),
    model: String(body.vModel || ""), color: String(body.vColor || ""),
    vin: String(body.vVin || ""), mileage: String(body.vMileage || ""),
  })
  await query(
    `INSERT INTO invoices (id, customerId, estimateId, status, title, vehicleInfo, notes, taxRate, dueDate, createdAt, updatedAt)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    [id, String(body.customerId), body.fromEstimateId ? String(body.fromEstimateId) : null,
     String(body.title), vehicle, body.notes ? String(body.notes) : null, taxRate, dueDate, now, now]
  )
  return c.redirect(`/admin/invoices/${id}`)
})

app.post("/:id/delete", async (c) => {
  const { id } = c.req.param()
  await query("DELETE FROM invoices WHERE id = ?", [id])
  return c.redirect("/admin/invoices")
})

export { app as invoiceRoutes }
