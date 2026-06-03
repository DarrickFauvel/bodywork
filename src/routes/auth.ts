import { Hono } from "hono"
import { auth } from "../auth/config"
import { render } from "../views/renderer"
import { readFileSync } from "fs"
import { join } from "path"

const app = new Hono()

app.get("/login", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null)
  if (session) return c.redirect("/admin/dashboard")
  return c.html(await render("./login", { error: null }))
})

app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null)
  if (session) return c.redirect("/admin/dashboard")
  return c.html(await render("./landing", {}))
})

app.get("/signup", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null)
  if (session) return c.redirect("/admin/dashboard")
  return c.html(await render("./signup", { error: null }))
})

app.get("/logout", async (c) => {
  await auth.api.signOut({ headers: c.req.raw.headers }).catch(() => null)
  const res = c.redirect("/login")
  res.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
  return res
})

app.get("/privacy", async (c) => {
  return c.html(await render("./privacy", {}))
})

// Mount Better Auth handler for all /auth/* routes
app.all("/auth/*", async (c) => {
  return auth.handler(c.req.raw)
})

export { app as authRoutes }
