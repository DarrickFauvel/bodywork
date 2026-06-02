import { Hono } from "hono"
import { requireAdmin } from "../auth/middleware"
import { libsql, query } from "../db/client"
import { render } from "../views/renderer"
import { fmtDate } from "../lib/html"
import type { Customer, EstimateWithCustomer, InvoiceWithCustomer } from "../types"

const app = new Hono()
app.use("*", requireAdmin)

app.get("/", async (c) => {
  const rows = await libsql.execute("SELECT * FROM customers ORDER BY name ASC")
  const customers = rows.rows as unknown as Customer[]
  return c.html(await render("./layout", {
    title: "Customers",
    activeNav: "customers",
    content: await render("./customers/list", { customers, fmtDate }),
  }))
})

app.get("/new", async (c) => {
  return c.html(await render("./layout", {
    title: "New Customer",
    activeNav: "customers",
    content: await render("./customers/form", { customer: null }),
  }))
})

app.get("/:id", async (c) => {
  const { id } = c.req.param()
  const [custRow, estRows, invRows] = await Promise.all([
    query("SELECT * FROM customers WHERE id = ?", [id]),
    query(`SELECT e.*, c.name AS customerName FROM estimates e
           JOIN customers c ON c.id = e.customerId
           WHERE e.customerId = ? ORDER BY e.createdAt DESC`, [id]),
    query(`SELECT i.*, c.name AS customerName FROM invoices i
           JOIN customers c ON c.id = i.customerId
           WHERE i.customerId = ? ORDER BY i.createdAt DESC`, [id]),
  ])
  if (!custRow.rows[0]) return c.notFound()
  const customer = custRow.rows[0] as unknown as Customer
  return c.html(await render("./layout", {
    title: customer.name,
    activeNav: "customers",
    content: await render("./customers/detail", {
      customer,
      estimates: estRows.rows as unknown as EstimateWithCustomer[],
      invoices: invRows.rows as unknown as InvoiceWithCustomer[],
      fmtDate,
    }),
  }))
})

app.get("/:id/edit", async (c) => {
  const { id } = c.req.param()
  const row = await query("SELECT * FROM customers WHERE id = ?", [id])
  if (!row.rows[0]) return c.notFound()
  const customer = row.rows[0] as unknown as Customer
  return c.html(await render("./layout", {
    title: `Edit ${customer.name}`,
    activeNav: "customers",
    content: await render("./customers/form", { customer }),
  }))
})

app.post("/", async (c) => {
  const body = await c.req.parseBody()
  const id = crypto.randomUUID()
  const now = Date.now()
  await query(
    `INSERT INTO customers (id, name, email, phone, address, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, String(body.name), body.email ? String(body.email) : null,
     body.phone ? String(body.phone) : null, body.address ? String(body.address) : null,
     body.notes ? String(body.notes) : null, now, now]
  )
  return c.redirect(`/admin/customers/${id}`)
})

app.post("/:id", async (c) => {
  const { id } = c.req.param()
  const body = await c.req.parseBody()
  if (body._method === "PUT") {
    await query(
      `UPDATE customers SET name=?, email=?, phone=?, address=?, notes=?, updatedAt=? WHERE id=?`,
      [String(body.name), body.email ? String(body.email) : null,
       body.phone ? String(body.phone) : null, body.address ? String(body.address) : null,
       body.notes ? String(body.notes) : null, Date.now(), id]
    )
    return c.redirect(`/admin/customers/${id}`)
  }
  return c.notFound()
})

app.post("/:id/delete", async (c) => {
  const { id } = c.req.param()
  await query("DELETE FROM customers WHERE id = ?", [id])
  return c.redirect("/admin/customers")
})

export { app as customerRoutes }
