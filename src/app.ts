import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { requireAdmin } from "./auth/middleware"
import { libsql, query } from "./db/client"
import { render } from "./views/renderer"
import { renderLayout } from "./views/layout-helper"
import { fmtDate } from "./lib/html"
import { fmt } from "./lib/totals"
import { authRoutes } from "./routes/auth"
import { customerRoutes } from "./routes/customers"
import { estimateRoutes } from "./routes/estimates"
import { invoiceRoutes } from "./routes/invoices"
import { sseRoutes } from "./routes/sse"
import { publicRoutes } from "./routes/public"
import { billingRoutes } from "./routes/billing"
import type { AppVariables, Settings } from "./types"

const app = new Hono<{ Variables: AppVariables }>()

// Static files
app.use("/public/*", serveStatic({ root: "./" }))

// Auth + public routes
app.route("/", authRoutes)
app.route("/", publicRoutes)

// Admin: Dashboard
app.get("/admin/dashboard", requireAdmin, async (c) => {
  const [openEst, pendingInv, paidMonth, recentEst, recentInv] = await Promise.all([
    libsql.execute("SELECT COUNT(*) AS cnt FROM estimates WHERE status NOT IN ('approved','declined')"),
    libsql.execute(`
      SELECT COALESCE(SUM(li.subtotal), 0) AS total FROM invoices i
      LEFT JOIN (
        SELECT invoiceId,
          SUM(CASE type WHEN 'labor' THEN laborHours*laborRate
                        WHEN 'sublet' THEN flatPrice
                        ELSE quantity*unitPrice END) AS subtotal
        FROM line_items GROUP BY invoiceId
      ) li ON li.invoiceId = i.id
      WHERE i.status = 'sent'`),
    libsql.execute(`
      SELECT COALESCE(SUM(li.subtotal), 0) AS total FROM invoices i
      LEFT JOIN (
        SELECT invoiceId,
          SUM(CASE type WHEN 'labor' THEN laborHours*laborRate
                        WHEN 'sublet' THEN flatPrice
                        ELSE quantity*unitPrice END) AS subtotal
        FROM line_items GROUP BY invoiceId
      ) li ON li.invoiceId = i.id
      WHERE i.status = 'paid' AND i.paidAt >= ${Date.now() - 30 * 24 * 60 * 60 * 1000}`),
    libsql.execute(`
      SELECT e.*, c.name AS customerName FROM estimates e
      JOIN customers c ON c.id = e.customerId
      ORDER BY e.createdAt DESC LIMIT 5`),
    libsql.execute(`
      SELECT i.*, c.name AS customerName FROM invoices i
      JOIN customers c ON c.id = i.customerId
      ORDER BY i.createdAt DESC LIMIT 5`),
  ])

  return c.html(await renderLayout(c, {
    title: "Dashboard",
    activeNav: "dashboard",
    content: await render("./dashboard", {
      openEstimates: (openEst.rows[0] as Record<string, unknown>)?.cnt ?? 0,
      pendingInvoicesTotal: (pendingInv.rows[0] as Record<string, unknown>)?.total ?? 0,
      paidThisMonth: (paidMonth.rows[0] as Record<string, unknown>)?.total ?? 0,
      recentEstimates: recentEst.rows,
      recentInvoices: recentInv.rows,
      fmtDate,
      fmt,
    }),
  }))
})

// Admin: Settings
app.get("/admin/settings", requireAdmin, async (c) => {
  const row = await libsql.execute("SELECT * FROM settings WHERE id = 'singleton'")
  const settings = (row.rows[0] ?? {}) as unknown as Settings
  return c.html(await renderLayout(c, {
    title: "Settings",
    activeNav: "settings",
    content: await render("./settings", { settings }),
  }))
})

app.post("/admin/settings", requireAdmin, async (c) => {
  const body = await c.req.parseBody()
  const taxRate = parseFloat(body.defaultTaxRate as string || "0") / 100
  await query(
    `INSERT INTO settings (id, shopName, phone, email, address, defaultLaborRate, defaultTaxRate, updatedAt)
     VALUES ('singleton', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       shopName=excluded.shopName, phone=excluded.phone, email=excluded.email,
       address=excluded.address, defaultLaborRate=excluded.defaultLaborRate,
       defaultTaxRate=excluded.defaultTaxRate, updatedAt=excluded.updatedAt`,
    [body.shopName ? String(body.shopName) : null, body.phone ? String(body.phone) : null,
     body.email ? String(body.email) : null, body.address ? String(body.address) : null,
     parseFloat(String(body.defaultLaborRate || "95")), taxRate, Date.now()]
  )
  return c.redirect("/admin/settings")
})

// Admin sub-routers
app.route("/admin/customers", customerRoutes)
app.route("/admin/estimates", estimateRoutes)
app.route("/admin/invoices", invoiceRoutes)
app.route("/sse", sseRoutes)
app.route("/", billingRoutes)

export { app }
