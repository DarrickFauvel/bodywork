import { Hono } from "hono"
import { requireAdmin } from "../auth/middleware"
import { libsql, query } from "../db/client"
import { render } from "../views/renderer"
import { renderLayout } from "../views/layout-helper"
import { fmtDate } from "../lib/html"
import { lineItemRow, totalsRow } from "../views/partials"
import { countEstimatesThisMonth, atEstimateLimit, FREE_ESTIMATE_LIMIT } from "../lib/plan"
import type { AppVariables, Customer, Estimate, EstimateWithCustomer, LineItem, Settings } from "../types"

const app = new Hono<{ Variables: AppVariables }>()
app.use("*", requireAdmin)

app.get("/", async (c) => {
  const plan = c.get("plan") as string
  const activeTab = c.req.query("tab") ?? "all"
  const [rows, monthCount] = await Promise.all([
    libsql.execute(
      `SELECT e.*, c.name AS customerName FROM estimates e
       JOIN customers c ON c.id = e.customerId
       ORDER BY e.createdAt DESC`
    ),
    countEstimatesThisMonth(),
  ])
  let estimates = rows.rows as unknown as EstimateWithCustomer[]
  if (activeTab !== "all") estimates = estimates.filter((e) => e.status === activeTab)
  return c.html(await renderLayout(c, {
    title: "Estimates",
    activeNav: "estimates",
    content: await render("./estimates/list", {
      estimates, activeTab, fmtDate, plan, monthCount,
      limit: FREE_ESTIMATE_LIMIT, atLimit: plan === "free" && atEstimateLimit(monthCount),
    }),
  }))
})

app.get("/new", async (c) => {
  const plan = c.get("plan") as string
  if (plan === "free") {
    const count = await countEstimatesThisMonth()
    if (atEstimateLimit(count)) return c.redirect("/upgrade")
  }
  const prefillCustomerId = c.req.query("customerId") ?? ""
  const [custRows, settingsRow] = await Promise.all([
    libsql.execute("SELECT id, name FROM customers ORDER BY name ASC"),
    libsql.execute("SELECT * FROM settings WHERE id = 'singleton'"),
  ])
  return c.html(await renderLayout(c, {
    title: "New Estimate",
    activeNav: "estimates",
    content: await render("./estimates/form", {
      customers: custRows.rows,
      prefillCustomerId,
      settings: settingsRow.rows[0] ?? {},
    }),
  }))
})

app.get("/:id", async (c) => {
  const { id } = c.req.param()
  const [estRow, custRow, itemRows, settingsRow] = await Promise.all([
    query("SELECT * FROM estimates WHERE id = ?", [id]),
    query("SELECT c.* FROM customers c JOIN estimates e ON e.customerId = c.id WHERE e.id = ?", [id]),
    query("SELECT * FROM line_items WHERE estimateId = ? ORDER BY sortOrder ASC, createdAt ASC", [id]),
    libsql.execute("SELECT * FROM settings WHERE id = 'singleton'"),
  ])
  if (!estRow.rows[0]) return c.notFound()
  const estimate = estRow.rows[0] as unknown as Estimate
  const customer = custRow.rows[0] as unknown as Customer
  const items = itemRows.rows as unknown as LineItem[]
  const settings = (settingsRow.rows[0] ?? { defaultLaborRate: 95, defaultTaxRate: 0 }) as unknown as Settings
  const vehicle = estimate.vehicleInfo ? JSON.parse(estimate.vehicleInfo as string) : {}
  const shareUrl = estimate.shareToken
    ? `${process.env.ORIGIN ?? "http://localhost:3000"}/share/${estimate.shareToken}`
    : null

  return c.html(await renderLayout(c, {
    title: estimate.title,
    activeNav: "estimates",
    content: await render("./estimates/detail", {
      estimate, customer, vehicle, shareUrl, settings,
      lineItemsHtml: items.map(lineItemRow).join(""),
      totalsHtml: totalsRow(items, estimate.taxRate),
      fmtDate,
    }),
  }))
})

app.post("/", async (c) => {
  const plan = c.get("plan") as string
  if (plan === "free") {
    const count = await countEstimatesThisMonth()
    if (atEstimateLimit(count)) return c.redirect("/upgrade")
  }
  const body = await c.req.parseBody()
  const id = crypto.randomUUID()
  const now = Date.now()
  const taxRate = parseFloat(String(body.taxRate || "0")) / 100
  const vehicle = JSON.stringify({
    year: String(body.vYear || ""), make: String(body.vMake || ""),
    model: String(body.vModel || ""), color: String(body.vColor || ""),
    vin: String(body.vVin || ""), mileage: String(body.vMileage || ""),
  })
  await query(
    `INSERT INTO estimates (id, customerId, status, title, vehicleInfo, notes, taxRate, createdAt, updatedAt)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    [id, String(body.customerId), String(body.title), vehicle,
     body.notes ? String(body.notes) : null, taxRate, now, now]
  )
  return c.redirect(`/admin/estimates/${id}`)
})

app.post("/:id/delete", async (c) => {
  const { id } = c.req.param()
  await query("DELETE FROM estimates WHERE id = ?", [id])
  return c.redirect("/admin/estimates")
})

export { app as estimateRoutes }
