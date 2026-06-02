import type { Context, Next } from "hono"
import { auth } from "./config"
import { getUserPlan } from "../lib/plan"

export async function requireAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect("/login")
  const role = (session.user as Record<string, unknown>).role as string | undefined
  c.set("user", session.user)
  c.set("plan", await getUserPlan(session.user.id))
  c.set("isSuperAdmin", role === "superadmin")
  await next()
}

export async function requireSuperAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect("/login")
  const role = (session.user as Record<string, unknown>).role as string | undefined
  if (role !== "superadmin") return c.redirect("/admin/dashboard")
  c.set("user", session.user)
  c.set("plan", await getUserPlan(session.user.id))
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
