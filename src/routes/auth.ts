import { Hono } from "hono"
import { auth } from "../auth/config"
import { render } from "../views/renderer"

const app = new Hono()

app.get("/login", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null)
  if (session) return c.redirect("/admin/dashboard")
  return c.html(await render("./login", { error: null }))
})

// Catch the sign-in redirect that Better Auth sends after successful login
// Better Auth redirects to callbackURL which defaults to /
app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null)
  if (session) return c.redirect("/admin/dashboard")
  return c.redirect("/login")
})

// Mount Better Auth handler for all /auth/* routes
app.all("/auth/*", async (c) => {
  return auth.handler(c.req.raw)
})

export { app as authRoutes }
