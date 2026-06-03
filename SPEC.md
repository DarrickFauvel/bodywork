# Bodywork — Product Spec

Autobody shop estimate and invoice tool. Built for small shop owners to manage customers, write estimates, and convert them to invoices.

## Users

| Role | Description |
|---|---|
| Shop owner (admin) | Creates and manages customers, estimates, invoices |
| Superadmin | Internal — manages accounts and plans |

## Features

### Customers
- Create, view, edit, delete customers
- Fields: name, email, phone, address, notes

### Estimates
- Create estimates with line items (labor, parts)
- Statuses: draft, sent, approved, declined
- Convert approved estimate → invoice
- Free plan: 3 estimates/month cap
- Paid plan: unlimited

### Invoices
- Create invoices (standalone or from estimate)
- Line items with quantity, unit price, tax toggle
- Statuses: draft, sent, paid
- Free plan: invoices blocked (upgrade required)
- Paid plan: unlimited

### Settings
- Shop name, address, phone, email
- Used to pre-fill estimate/invoice headers

### Account
- Email/password auth via Better Auth
- Change password, delete account
- Data export (GDPR right of access)

### Billing
- Free tier: 3 estimates/month, no invoices
- Paid tier: unlimited estimates and invoices
- Upgrade flow: `/upgrade` page → Stripe Checkout (stub — Stripe not yet configured)
- Stripe webhook stub at `/billing/webhook`

### GDPR
- Privacy policy page (`/privacy`)
- Cookie/session notice
- Account deletion (user + all associated data)
- Data export

### Admin / Share
- QR code + shareable link at `/admin/share` for distributing the app URL
- Superadmin panel at `/superadmin` — list accounts, toggle plan (free ↔ paid)

## Plan Limits

| Feature | Free | Paid |
|---|---|---|
| Estimates | 3/month | Unlimited |
| Invoices | — | Unlimited |
| Customers | Unlimited | Unlimited |

## Planned / Not Yet Built

- **Stripe integration** — Checkout and webhook handlers are stubbed; need Stripe keys and live implementation
- **App logo** — Replace gear emoji with a proper SVG logo
- **Beta tester access** — Manually upgrade first tester's plan via superadmin panel

## Out of Scope (for now)

- Multi-user shops (one login per shop)
- Customer-facing portal (estimates/invoices are internal only)
- Payment collection through the app
- PDF export
- Email sending
