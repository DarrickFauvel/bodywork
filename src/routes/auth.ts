import { Hono } from "hono"
import { auth } from "../auth/config"
import { render } from "../views/renderer"

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

// Mount Better Auth handler for all /auth/* routes
app.all("/auth/*", async (c) => {
  return auth.handler(c.req.raw)
})

export { app as authRoutes }
