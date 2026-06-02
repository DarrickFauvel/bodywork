import { createClient, type InArgs } from "@libsql/client"
import { Kysely } from "kysely"
import { LibsqlDialect } from "kysely-libsql"

const url = process.env.TURSO_URL
const authToken = process.env.TURSO_TOKEN

if (!url) throw new Error("TURSO_URL is required")

export const libsql = createClient({ url, authToken })

// Kysely instance used exclusively by Better Auth
export const kysely = new Kysely<Record<string, unknown>>({
  dialect: new LibsqlDialect({ client: libsql }),
})

// Typed query helper — accepts unknown[] for args so route handlers don't need casts
export async function query(sql: string, args?: unknown[]) {
  return libsql.execute({ sql, args: (args ?? []) as InArgs })
}
