import { libsql } from "./client"

async function tryAlter(stmt: string) {
  try {
    await libsql.execute(stmt)
    console.log("OK:", stmt.slice(0, 70))
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) {
      console.log("Skip (already exists):", stmt.slice(0, 70))
    } else {
      throw e
    }
  }
}

async function tryIndex(stmt: string) {
  try {
    await libsql.execute(stmt)
    console.log("OK:", stmt.slice(0, 70))
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("Skip (already exists):", stmt.slice(0, 70))
    } else {
      throw e
    }
  }
}

// 1. Add ownerId columns
await tryAlter(`ALTER TABLE customers ADD COLUMN ownerId TEXT`)
await tryAlter(`ALTER TABLE estimates ADD COLUMN ownerId TEXT`)
await tryAlter(`ALTER TABLE invoices  ADD COLUMN ownerId TEXT`)

// 2. Indexes
await tryIndex(`CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(ownerId)`)
await tryIndex(`CREATE INDEX IF NOT EXISTS idx_estimates_owner ON estimates(ownerId)`)
await tryIndex(`CREATE INDEX IF NOT EXISTS idx_invoices_owner  ON invoices(ownerId)`)
await tryIndex(`CREATE INDEX IF NOT EXISTS idx_user_role       ON "user"(role)`)

// 3. Backfill existing rows to admin user + rename settings singleton
const userRow = await libsql.execute(
  `SELECT id FROM "user" WHERE email = 'admin@bodywork.local' LIMIT 1`
)
const adminId = userRow.rows[0]?.id as string | undefined

if (adminId) {
  await libsql.execute({ sql: `UPDATE customers SET ownerId = ? WHERE ownerId IS NULL`, args: [adminId] })
  await libsql.execute({ sql: `UPDATE estimates SET ownerId = ? WHERE ownerId IS NULL`, args: [adminId] })
  await libsql.execute({ sql: `UPDATE invoices  SET ownerId = ? WHERE ownerId IS NULL`, args: [adminId] })
  await libsql.execute({ sql: `UPDATE settings SET id = ? WHERE id = 'singleton'`,     args: [adminId] })
  console.log(`Backfilled rows to admin user ${adminId}`)
} else {
  console.log("Admin user not found — skipping backfill (run seed first if needed)")
}

console.log("Multitenant migration complete.")
