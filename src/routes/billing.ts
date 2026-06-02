import { Hono } from "hono"
import { requireAdmin } from "../auth/middleware"
import { render } from "../views/renderer"
import type { AppVariables } from "../types"

const app = new Hono<{ Variables: AppVariables }>()
app.use("*", requireAdmin)

app.get("/upgrade", async (c) => {
  const plan = c.get("plan") as string
  return c.html(await render("./upgrade", { plan }))
})

// Stub: will trigger Stripe Checkout when keys are configured
app.post("/billing/checkout", async (c) => {
  return c.json({ error: "Stripe not yet configured." }, 503)
})

// Stub: will receive Stripe webhook events to update plan on payment
app.post("/billing/webhook", async (c) => {
  return c.json({ received: true })
})

export { app as billingRoutes }
