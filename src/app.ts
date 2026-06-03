import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { requireAdmin } from "./auth/middleware"
import { query } from "./db/client"
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
import { superadminRoutes } from "./routes/superadmin"
import { accountRoutes } from "./routes/account"
import type { AppVariables, Settings } from "./types"

const app = new Hono<{ Variables: AppVariables }>()

// Static files
app.use("/public/*", serveStatic({ root: "./" }))

// Auth + public routes
app.route("/", authRoutes)
app.route("/", publicRoutes)

// Admin: Dashboard
app.get("/admin/dashboard", requireAdmin, async (c) => {
  const userId = c.get("user").id
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const [openEst, pendingInv, paidMonth, recentEst, recentInv] = await Promise.all([
    query(`SELECT COUNT(*) AS cnt FROM estimates WHERE ownerId = ? AND status NOT IN ('approved','declined')`, [userId]),
    query(`
      SELECT COALESCE(SUM(li.subtotal), 0) AS total FROM invoices i
      LEFT JOIN (
        SELECT invoiceId,
          SUM(CASE type WHEN 'labor' THEN laborHours*laborRate
                        WHEN 'sublet' THEN flatPrice
                        ELSE quantity*unitPrice END) AS subtotal
        FROM line_items GROUP BY invoiceId
      ) li ON li.invoiceId = i.id
      WHERE i.status = 'sent' AND i.ownerId = ?`, [userId]),
    query(`
      SELECT COALESCE(SUM(li.subtotal), 0) AS total FROM invoices i
      LEFT JOIN (
        SELECT invoiceId,
          SUM(CASE type WHEN 'labor' THEN laborHours*laborRate
                        WHEN 'sublet' THEN flatPrice
                        ELSE quantity*unitPrice END) AS subtotal
        FROM line_items GROUP BY invoiceId
      ) li ON li.invoiceId = i.id
      WHERE i.status = 'paid' AND i.paidAt >= ? AND i.ownerId = ?`, [cutoff, userId]),
    query(`
      SELECT e.*, c.name AS customerName FROM estimates e
      JOIN customers c ON c.id = e.customerId
      WHERE e.ownerId = ? ORDER BY e.createdAt DESC LIMIT 5`, [userId]),
    query(`
      SELECT i.*, c.name AS customerName FROM invoices i
      JOIN customers c ON c.id = i.customerId
      WHERE i.ownerId = ? ORDER BY i.createdAt DESC LIMIT 5`, [userId]),
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

// Admin: Share
app.get("/admin/share", requireAdmin, async (c) => {
  const appUrl = (process.env.ORIGIN ?? new URL(c.req.url).origin).replace(/\/$/, "")
  return c.html(await renderLayout(c, {
    title: "Share",
    activeNav: "settings",
    content: await render("./share", { appUrl }),
  }))
})

// Admin: Settings
app.get("/admin/settings", requireAdmin, async (c) => {
  const userId = c.get("user").id
  const row = await query("SELECT * FROM settings WHERE id = ?", [userId])
  const settings = (row.rows[0] ?? {}) as unknown as Settings
  return c.html(await renderLayout(c, {
    title: "Settings",
    activeNav: "settings",
    content: await render("./settings", { settings, isSuperAdmin: c.get("isSuperAdmin") }),
  }))
})

app.post("/admin/settings", requireAdmin, async (c) => {
  const userId = c.get("user").id
  const body = await c.req.parseBody()
  const taxRate = parseFloat(body.defaultTaxRate as string || "0") / 100
  await query(
    `INSERT INTO settings (id, shopName, phone, email, address, defaultLaborRate, defaultTaxRate, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       shopName=excluded.shopName, phone=excluded.phone, email=excluded.email,
       address=excluded.address, defaultLaborRate=excluded.defaultLaborRate,
       defaultTaxRate=excluded.defaultTaxRate, updatedAt=excluded.updatedAt`,
    [userId, body.shopName ? String(body.shopName) : null, body.phone ? String(body.phone) : null,
     body.email ? String(body.email) : null, body.address ? String(body.address) : null,
     parseFloat(String(body.defaultLaborRate || "95")), taxRate, Date.now()]
  )
  return c.redirect("/admin/settings")
})

// Admin sub-routers
app.route("/admin/account", accountRoutes)
app.route("/admin/customers", customerRoutes)
app.route("/admin/estimates", estimateRoutes)
app.route("/admin/invoices", invoiceRoutes)
app.route("/sse", sseRoutes)
app.route("/", billingRoutes)
app.route("/superadmin", superadminRoutes)

export { app }
