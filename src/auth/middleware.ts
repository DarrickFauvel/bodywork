import type { Context, Next } from "hono"
import { auth } from "./config"
import { getUserPlan } from "../lib/plan"

export async function requireAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect("/login")
  c.set("user", session.user)
  c.set("plan", await getUserPlan(session.user.id))
  await next()
}

export async function getSession(c: Context) {
  try {
    return await auth.api.getSession({ headers: c.req.raw.headers })
  } catch {
    return null
  }
}
