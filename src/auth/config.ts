import { betterAuth } from "better-auth"
import { kyselyAdapter } from "@better-auth/kysely-adapter"
import { kysely } from "../db/client"

export const auth = betterAuth({
  baseURL: process.env.ORIGIN ?? "http://localhost:3000",
  basePath: "/auth",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  database: kyselyAdapter(kysely, { type: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieName: "bodywork_session",
    cookieCache: { enabled: false },
  },
  trustedOrigins: [process.env.ORIGIN ?? "http://localhost:3000"],
})
