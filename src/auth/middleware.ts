import type { Context, Next } from "hono"
import { auth } from "./config"
import { query } from "../db/client"
import { getUserPlan } from "../lib/plan"

async function getUserRole(userId: string): Promise<string> {
  const row = await query(`SELECT role FROM "user" WHERE id = ?`, [userId])
  return ((row.rows[0] as Record<string, unknown>)?.role as string) ?? "admin"
}

export async function requireAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect("/login")
  const [plan, role] = await Promise.all([
    getUserPlan(session.user.id),
    getUserRole(session.user.id),
  ])
  c.set("user", session.user)
  c.set("plan", plan)
  c.set("isSuperAdmin", role === "superadmin")
  await next()
}

export async function requireSuperAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect("/login")
  const role = await getUserRole(session.user.id)
  if (role !== "superadmin") return c.redirect("/admin/dashboard")
  const plan = await getUserPlan(session.user.id)
  c.set("user", session.user)
  c.set("plan", plan)
  c.set("isSuperAdmin", true)
  await next()
}

export async function getSession(c: Context) {
  try {
    return await auth.api.getSession({ headers: c.req.raw.headers })
  } catch {
    return null
  }
}
