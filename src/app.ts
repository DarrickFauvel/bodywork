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
import { uploadLogo, deleteLogo, resolveLogoUrl } from "./lib/cloudinary"
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
  const settings = resolveLogoUrl((row.rows[0] ?? {}) as unknown as Settings)
  return c.html(await renderLayout(c, {
    title: "Settings",
    activeNav: "settings",
    content: await render("./settings", { settings, isSuperAdmin: c.get("isSuperAdmin"), plan: c.get("plan") }),
  }))
})

app.post("/admin/settings", requireAdmin, async (c) => {
  const userId = c.get("user").id
  const plan = c.get("plan")
  const body = await c.req.parseBody()
  const taxRate = parseFloat(body.defaultTaxRate as string || "0") / 100

  let newLogoPublicId: string | null = null
  let brandColor: string | null = null

  if (plan === "paid") {
    const logoFile = body.logo instanceof File && body.logo.size > 0 ? body.logo : null
    if (logoFile) {
      newLogoPublicId = await uploadLogo(await logoFile.arrayBuffer(), logoFile.type, userId)
    }
    if (body.brandColor) brandColor = String(body.brandColor)
  }

  const existing = await query("SELECT logoData, logoPublicId, brandColor FROM settings WHERE id = ?", [userId])
  const prev = (existing.rows[0] ?? {}) as Record<string, unknown>

  // If uploading a new logo, delete the old Cloudinary asset
  if (newLogoPublicId && prev.logoPublicId) {
    await deleteLogo(prev.logoPublicId as string)
  }

  await query(
    `INSERT INTO settings (id, shopName, phone, email, address, defaultLaborRate, defaultTaxRate, logoData, logoPublicId, brandColor, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       shopName=excluded.shopName, phone=excluded.phone, email=excluded.email,
       address=excluded.address, defaultLaborRate=excluded.defaultLaborRate,
       defaultTaxRate=excluded.defaultTaxRate,
       logoData=excluded.logoData, logoPublicId=excluded.logoPublicId,
       brandColor=excluded.brandColor, updatedAt=excluded.updatedAt`,
    [userId, body.shopName ? String(body.shopName) : null, body.phone ? String(body.phone) : null,
     body.email ? String(body.email) : null, body.address ? String(body.address) : null,
     parseFloat(String(body.defaultLaborRate || "95")), taxRate,
     newLogoPublicId ? null : (prev.logoData as string | null) ?? null,
     newLogoPublicId ?? (prev.logoPublicId as string | null) ?? null,
     brandColor ?? (prev.brandColor as string | null) ?? null,
     Date.now()]
  )
  return c.redirect("/admin/settings")
})

app.post("/admin/settings/remove-logo", requireAdmin, async (c) => {
  const userId = c.get("user").id
  if (c.get("plan") === "paid") {
    const row = await query("SELECT logoPublicId FROM settings WHERE id=?", [userId])
    const publicId = (row.rows[0] as Record<string, unknown> | undefined)?.logoPublicId as string | null
    if (publicId) await deleteLogo(publicId)
    await query("UPDATE settings SET logoData=NULL, logoPublicId=NULL WHERE id=?", [userId])
  }
  return c.redirect("/admin/settings")
})

app.post("/admin/settings/reset-branding", requireAdmin, async (c) => {
  const userId = c.get("user").id
  if (c.get("plan") === "paid") {
    const row = await query("SELECT logoPublicId FROM settings WHERE id=?", [userId])
    const publicId = (row.rows[0] as Record<string, unknown> | undefined)?.logoPublicId as string | null
    if (publicId) await deleteLogo(publicId)
    await query("UPDATE settings SET logoData=NULL, logoPublicId=NULL, brandColor=NULL WHERE id=?", [userId])
  }
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
