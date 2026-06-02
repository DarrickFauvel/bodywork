import type { Context } from "hono"
import { render } from "./renderer"
import type { AppVariables } from "../types"

export async function renderLayout(c: Context<{ Variables: AppVariables }>, opts: {
  title: string
  activeNav: string
  content: string
}) {
  const plan = (c.get("plan") as string | undefined) ?? "free"
  return render("./layout", { ...opts, plan })
}
