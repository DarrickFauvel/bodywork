import { query } from "./client"
import { auth } from "../auth/config"
import { generateToken } from "../lib/tokens"

console.log("Seeding database...")

const now = Date.now()

// Admin user via Better Auth
try {
  await auth.api.signUpEmail({
    body: { email: "admin@bodywork.local", password: "password123", name: "Shop Admin" },
  })
  console.log("Admin user created: admin@bodywork.local / password123")
} catch {
  console.log("Admin user may already exist, skipping.")
}

// Settings
await query(
  `INSERT OR REPLACE INTO settings (id, shopName, phone, email, address, defaultLaborRate, defaultTaxRate, updatedAt)
   VALUES ('singleton', 'Apex Auto Body', '(555) 867-5309', 'info@apexautobody.com', '420 Industrial Blvd, Springfield, IL 62701', 95.0, 0.08, ?)`,
  [now]
)

// Customers
const customers = [
  { id: crypto.randomUUID(), name: "Maria Garcia", email: "maria@example.com", phone: "(555) 201-3344", address: "123 Oak St, Springfield, IL" },
  { id: crypto.randomUUID(), name: "James Whitfield", email: "jwhit@example.com", phone: "(555) 489-2200", address: "900 Elm Ave, Springfield, IL" },
  { id: crypto.randomUUID(), name: "Sandra Okafor", email: "s.okafor@example.com", phone: "(555) 317-0011", address: null },
]

for (const c of customers) {
  await query(
    `INSERT OR IGNORE INTO customers (id, name, email, phone, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [c.id, c.name, c.email, c.phone, c.address, now, now]
  )
}

// Estimate 1 — draft with all 4 line item types
const est1Id = crypto.randomUUID()
await query(
  `INSERT OR IGNORE INTO estimates (id, customerId, status, title, vehicleInfo, notes, taxRate, createdAt, updatedAt)
   VALUES (?, ?, 'draft', ?, ?, ?, 0.08, ?, ?)`,
  [est1Id, customers[0].id,
   "2021 Toyota Camry — Front-End Collision",
   JSON.stringify({ year: "2021", make: "Toyota", model: "Camry", color: "Midnight Blue", vin: "4T1B11HK4MU012345", mileage: "34,200" }),
   "Customer reports front airbags deployed. Insurance claim #AUT-2024-88812.", now, now]
)

const items1: Array<{type:string; desc:string; hours?:number; rate?:number; partNum?:string; qty?:number; price?:number; flat?:number}> = [
  { type: "labor", desc: "Front bumper R&R", hours: 3.5, rate: 95 },
  { type: "labor", desc: "Hood replacement", hours: 2.0, rate: 95 },
  { type: "parts", desc: "Front bumper cover", partNum: "53101-06A30", qty: 1, price: 287.50 },
  { type: "parts", desc: "Hood assembly", partNum: "53301-06A30", qty: 1, price: 645.00 },
  { type: "paint", desc: "Midnight Blue basecoat/clearcoat — hood + bumper", qty: 1, price: 220.00 },
  { type: "sublet", desc: "Frame alignment check (outsourced)", flat: 175.00 },
]

for (let i = 0; i < items1.length; i++) {
  const item = items1[i]
  await query(
    `INSERT OR IGNORE INTO line_items (id, estimateId, type, sortOrder, description, laborHours, laborRate, partNumber, quantity, unitPrice, flatPrice, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), est1Id, item.type, i, item.desc,
     item.hours ?? null, item.rate ?? null, item.partNum ?? null,
     item.qty ?? null, item.price ?? null, item.flat ?? null, now, now]
  )
}

// Estimate 2 — approved, with share token
const est2Id = crypto.randomUUID()
const shareToken2 = generateToken()
await query(
  `INSERT OR IGNORE INTO estimates (id, customerId, status, title, vehicleInfo, taxRate, shareToken, sentAt, approvedAt, createdAt, updatedAt)
   VALUES (?, ?, 'approved', ?, ?, 0.08, ?, ?, ?, ?, ?)`,
  [est2Id, customers[1].id, "2018 Honda Civic — Passenger Door Damage",
   JSON.stringify({ year: "2018", make: "Honda", model: "Civic", color: "Silver", vin: "2HGFC2F59JH012345", mileage: "61,800" }),
   shareToken2, now - 86400000, now - 43200000, now - 86400000, now]
)
await query(
  `INSERT OR IGNORE INTO line_items (id, estimateId, type, sortOrder, description, laborHours, laborRate, createdAt, updatedAt)
   VALUES (?, ?, 'labor', 0, ?, 4.5, 95, ?, ?)`,
  [crypto.randomUUID(), est2Id, "Passenger door shell replacement + blend", now, now]
)
await query(
  `INSERT OR IGNORE INTO line_items (id, estimateId, type, sortOrder, description, partNumber, quantity, unitPrice, createdAt, updatedAt)
   VALUES (?, ?, 'parts', 1, ?, ?, 1, ?, ?, ?)`,
  [crypto.randomUUID(), est2Id, "Door shell, RH passenger", "67010-TBA-A00ZZ", 318.75, now, now]
)

// Invoice 1 — converted from estimate 2, status: sent
const inv1Id = crypto.randomUUID()
const invToken1 = generateToken()
await query(
  `INSERT OR IGNORE INTO invoices (id, estimateId, customerId, status, title, vehicleInfo, taxRate, shareToken, dueDate, sentAt, createdAt, updatedAt)
   VALUES (?, ?, ?, 'sent', ?, ?, 0.08, ?, ?, ?, ?, ?)`,
  [inv1Id, est2Id, customers[1].id, "2018 Honda Civic — Passenger Door Damage",
   JSON.stringify({ year: "2018", make: "Honda", model: "Civic", color: "Silver", vin: "2HGFC2F59JH012345", mileage: "61,800" }),
   invToken1, now + 14 * 86400000, now - 43200000, now - 43200000, now]
)
await query(
  `INSERT OR IGNORE INTO line_items (id, invoiceId, type, sortOrder, description, laborHours, laborRate, createdAt, updatedAt)
   VALUES (?, ?, 'labor', 0, ?, 4.5, 95, ?, ?)`,
  [crypto.randomUUID(), inv1Id, "Passenger door shell replacement + blend", now, now]
)
await query(
  `INSERT OR IGNORE INTO line_items (id, invoiceId, type, sortOrder, description, partNumber, quantity, unitPrice, createdAt, updatedAt)
   VALUES (?, ?, 'parts', 1, ?, ?, 1, ?, ?, ?)`,
  [crypto.randomUUID(), inv1Id, "Door shell, RH passenger", "67010-TBA-A00ZZ", 318.75, now, now]
)

console.log("\nSeed complete!")
console.log(`Login: admin@bodywork.local / password123`)
console.log(`Public estimate URL: /share/${shareToken2}`)
console.log(`Public invoice URL: /share/${invToken1}`)
