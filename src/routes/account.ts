import { Hono } from "hono"
import { requireAdmin } from "../auth/middleware"
import { query } from "../db/client"
import { renderLayout } from "../views/layout-helper"
import { render } from "../views/renderer"
import type { AppVariables } from "../types/index"

const app = new Hono<{ Variables: AppVariables }>()

app.get("/", requireAdmin, async (c) => {
  const user = c.get("user")
  return c.html(await renderLayout(c, {
    title: "Account & Privacy",
    activeNav: "settings",
    content: await render("./account", { user, error: null }),
  }))
})

app.get("/export", requireAdmin, async (c) => {
  const user   = c.get("user")
  const userId = user.id

  const [settingsRes, customersRes, estimatesRes, invoicesRes] = await Promise.all([
    query("SELECT * FROM settings WHERE id = ?", [userId]),
    query("SELECT * FROM customers WHERE ownerId = ? ORDER BY createdAt", [userId]),
    query("SELECT * FROM estimates WHERE ownerId = ? ORDER BY createdAt", [userId]),
    query("SELECT * FROM invoices  WHERE ownerId = ? ORDER BY createdAt", [userId]),
  ])

  const estimateIds = (estimatesRes.rows as { id: string }[]).map(r => r.id)
  const invoiceIds  = (invoicesRes.rows  as { id: string }[]).map(r => r.id)

  const lineItemRows: unknown[] = []
  if (estimateIds.length) {
    const ph = estimateIds.map(() => "?").join(",")
    const res = await query(`SELECT * FROM line_items WHERE estimateId IN (${ph})`, estimateIds)
    lineItemRows.push(...res.rows)
  }
  if (invoiceIds.length) {
    const ph = invoiceIds.map(() => "?").join(",")
    const res = await query(`SELECT * FROM line_items WHERE invoiceId IN (${ph})`, invoiceIds)
    lineItemRows.push(...res.rows)
  }

  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    settings:  settingsRes.rows[0]  ?? null,
    customers: customersRes.rows,
    estimates: estimatesRes.rows,
    invoices:  invoicesRes.rows,
    lineItems: lineItemRows,
  }, null, 2)

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="bodywork-export-${Date.now()}.json"`,
    },
  })
})

app.post("/delete", requireAdmin, async (c) => {
  const user = c.get("user")
  const body = await c.req.parseBody()
  const confirmation = String(body.confirmation ?? "").trim().toLowerCase()

  if (confirmation !== user.email.toLowerCase()) {
    return c.html(await renderLayout(c, {
      title: "Account & Privacy",
      activeNav: "settings",
      content: await render("./account", {
        user,
        error: "Email did not match — account not deleted.",
      }),
    }))
  }

  const userId = user.id

  // Delete in FK-safe order; line_items cascade from estimates/invoices, session/account cascade from user
  await query("DELETE FROM invoices  WHERE ownerId = ?", [userId])
  await query("DELETE FROM estimates WHERE ownerId = ?", [userId])
  await query("DELETE FROM customers WHERE ownerId = ?", [userId])
  await query("DELETE FROM settings  WHERE id = ?",      [userId])
  await query(`DELETE FROM verification WHERE identifier = ?`, [user.email])
  await query(`DELETE FROM "user" WHERE id = ?`, [userId])

  const res = c.redirect("/?deleted=1")
  res.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
  return res
})

export { app as accountRoutes }
