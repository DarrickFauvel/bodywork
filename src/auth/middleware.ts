import type { Context, Next } from "hono"
import { auth } from "./config"

export async function requireAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect("/login")
  c.set("user", session.user)
  await next()
}

export async function getSession(c: Context) {
  try {
    return await auth.api.getSession({ headers: c.req.raw.headers })
  } catch {
    return null
  }
}
