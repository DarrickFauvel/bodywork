import { Eta } from "eta"
import { join } from "path"

export const eta = new Eta({
  views: join(import.meta.dir, "templates"),
  cache: process.env.NODE_ENV === "production",
  autoEscape: true,
})

export async function render(template: string, data: Record<string, unknown>): Promise<string> {
  return eta.renderAsync(template, data)
}
