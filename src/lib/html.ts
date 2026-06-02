// Escape HTML special chars for safe template interpolation
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Format Date from epoch ms
export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return ""
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// SSE event helpers — write raw bytes so each data: line is separate
export function patchElements(selector: string, html: string, mode = "outer"): string {
  const lines = html.split("\n").map((l) => `data: elements ${l}`).join("\n")
  return `event: datastar-patch-elements\ndata: selector ${selector}\ndata: mode ${mode}\n${lines}\n\n`
}

export function patchSignals(signals: Record<string, unknown>): string {
  return `event: datastar-patch-signals\ndata: signals ${JSON.stringify(signals)}\n\n`
}
