import { Hono } from "hono"
import { requireSuperAdmin } from "../auth/middleware"
import { libsql, query } from "../db/client"
import { render } from "../views/renderer"
import { renderLayout } from "../views/layout-helper"
import { fmtDate } from "../lib/html"
import type { AppVariables } from "../types"

const app = new Hono<{ Variables: AppVariables }>()
app.use("*", requireSuperAdmin)

app.get("/", (c) => c.redirect("/superadmin/accounts"))

app.get("/accounts", async (c) => {
  const rows = await libsql.execute(
    `SELECT id, name, email, role, plan, createdAt FROM "user" ORDER BY createdAt DESC`
  )
  return c.html(await renderLayout(c, {
    title: "Accounts",
    activeNav: "superadmin",
    content: await render("./superadmin/accounts", { accounts: rows.rows, fmtDate }),
  }))
})

app.post("/accounts/:id/toggle-plan", async (c) => {
  const { id } = c.req.param()
  const row = await query(`SELECT plan FROM "user" WHERE id = ?`, [id])
  if (!row.rows[0]) return c.notFound()
  const current = (row.rows[0] as Record<string, unknown>).plan as string
  const next = current === "paid" ? "free" : "paid"
  await query(`UPDATE "user" SET plan = ?, updatedAt = ? WHERE id = ?`, [next, Date.now(), id])
  return c.redirect("/superadmin/accounts")
})

export { app as superadminRoutes }
