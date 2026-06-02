import { readFileSync } from "fs"
import { join } from "path"
import { libsql } from "./client"

const schema = readFileSync(join(import.meta.dir, "schema.sql"), "utf-8")

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

console.log(`Running ${statements.length} DDL statements...`)

for (const stmt of statements) {
  await libsql.execute(stmt)
}

// Insert default settings row if not exists
await libsql.execute({
  sql: `INSERT OR IGNORE INTO settings (id, shopName, defaultLaborRate, defaultTaxRate, updatedAt)
        VALUES ('singleton', 'My Auto Body Shop', 95.0, 0.0, ?)`,
  args: [Date.now()],
})

console.log("Migration complete.")
