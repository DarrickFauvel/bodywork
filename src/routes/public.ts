import { Hono } from "hono"
import { query } from "../db/client"
import { render } from "../views/renderer"
import { fmtDate } from "../lib/html"
import { lineItemRowReadOnly, totalsRow } from "../views/partials"
import { resolveLogoUrl } from "../lib/cloudinary"
import type { Customer, Estimate, Invoice, LineItem, Settings } from "../types"

const app = new Hono()

app.get("/share/:token", async (c) => {
  const { token } = c.req.param()

  const estRow = await query("SELECT * FROM estimates WHERE shareToken = ?", [token])
  if (estRow.rows[0]) {
    const estimate = estRow.rows[0] as unknown as Estimate
    const [custRow, itemRows, settingsRow] = await Promise.all([
      query("SELECT * FROM customers WHERE id = ?", [estimate.customerId]),
      query("SELECT * FROM line_items WHERE estimateId = ? ORDER BY sortOrder ASC, createdAt ASC", [estimate.id]),
      query("SELECT * FROM settings WHERE id = ?", [estimate.ownerId]),
    ])
    const customer = custRow.rows[0] as unknown as Customer
    const items = itemRows.rows as unknown as LineItem[]
    const settings = resolveLogoUrl((settingsRow.rows[0] ?? {}) as unknown as Settings)
    const vehicle = estimate.vehicleInfo ? JSON.parse(estimate.vehicleInfo as string) : {}
    return c.html(await render("./public/estimate", {
      estimate, customer, vehicle, settings, fmtDate,
      lineItemsHtml: items.map(lineItemRowReadOnly).join(""),
      totalsHtml: totalsRow(items, estimate.taxRate),
    }))
  }

  const invRow = await query("SELECT * FROM invoices WHERE shareToken = ?", [token])
  if (invRow.rows[0]) {
    const invoice = invRow.rows[0] as unknown as Invoice
    const [custRow, itemRows, settingsRow] = await Promise.all([
      query("SELECT * FROM customers WHERE id = ?", [invoice.customerId]),
      query("SELECT * FROM line_items WHERE invoiceId = ? ORDER BY sortOrder ASC, createdAt ASC", [invoice.id]),
      query("SELECT * FROM settings WHERE id = ?", [invoice.ownerId]),
    ])
    const customer = custRow.rows[0] as unknown as Customer
    const items = itemRows.rows as unknown as LineItem[]
    const settings = resolveLogoUrl((settingsRow.rows[0] ?? {}) as unknown as Settings)
    const vehicle = invoice.vehicleInfo ? JSON.parse(invoice.vehicleInfo as string) : {}
    return c.html(await render("./public/invoice", {
      invoice, customer, vehicle, settings, fmtDate,
      lineItemsHtml: items.map(lineItemRowReadOnly).join(""),
      totalsHtml: totalsRow(items, invoice.taxRate),
    }))
  }

  return c.html(`<!DOCTYPE html><html><head><title>Not Found</title>
    <link rel="stylesheet" href="/public/styles.css"></head>
    <body style="background:var(--bg)"><div style="min-height:100vh;display:flex;align-items:center;justify-content:center">
    <div style="text-align:center;color:var(--text-muted)">
      <h2 style="font-size:3rem;color:var(--accent)">404</h2>
      <p>This link is invalid or has expired.</p>
    </div></div></body></html>`, 404)
})

export { app as publicRoutes }
