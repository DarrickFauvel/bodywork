import { app } from "./app"

const port = parseInt(process.env.PORT ?? "3000")

console.log(`Bodywork running on http://localhost:${port}`)

Bun.serve({
  fetch: app.fetch,
  port,
})
