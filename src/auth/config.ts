import { betterAuth } from "better-auth"
import { kyselyAdapter } from "@better-auth/kysely-adapter"
import { kysely } from "../db/client"

const origin = process.env.ORIGIN ?? "http://localhost:3000"

export const auth = betterAuth({
  baseURL: origin,
  basePath: "/auth",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  database: kyselyAdapter(kysely, { type: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: false },
  },
  // Accept localhost and any Codespace forwarded URL
  trustedOrigins: (request) => {
    const reqOrigin = request?.headers.get("origin") ?? ""
    const allowed =
      reqOrigin.startsWith("http://localhost") ||
      reqOrigin.startsWith("https://localhost") ||
      reqOrigin.endsWith(".app.github.dev") ||
      reqOrigin === origin
    return allowed ? [reqOrigin] : []
  },
})
