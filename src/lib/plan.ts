import { query, libsql } from "../db/client"

export type Plan = "free" | "paid"
export const FREE_ESTIMATE_LIMIT = 3

export async function getUserPlan(userId: string): Promise<Plan> {
  const row = await query(`SELECT plan FROM "user" WHERE id = ?`, [userId])
  const plan = (row.rows[0] as Record<string, unknown>)?.plan
  return plan === "paid" ? "paid" : "free"
}

export async function countEstimatesThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const row = await query(
    `SELECT COUNT(*) AS cnt FROM estimates WHERE ownerId = ? AND createdAt >= ?`,
    [userId, startOfMonth.getTime()]
  )
  return Number((row.rows[0] as Record<string, unknown>)?.cnt ?? 0)
}

export function atEstimateLimit(count: number): boolean {
  return count >= FREE_ESTIMATE_LIMIT
}
