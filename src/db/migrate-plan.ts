import { libsql } from "./client"

const stmts = [
  `ALTER TABLE "user" ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'`,
  `ALTER TABLE "user" ADD COLUMN stripeCustomerId TEXT`,
  `ALTER TABLE "user" ADD COLUMN stripeSubscriptionId TEXT`,
]

for (const stmt of stmts) {
  try {
    await libsql.execute(stmt)
    console.log("OK:", stmt.slice(0, 60))
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) {
      console.log("Skip (already exists):", stmt.slice(0, 60))
    } else {
      throw e
    }
  }
}

console.log("Plan migration complete.")
