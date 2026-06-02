import { esc } from "../lib/html"
import { lineItemSubtotal, documentTotals, fmt } from "../lib/totals"
import type { LineItem } from "../types"

export function lineItemRow(item: LineItem): string {
  const sub = lineItemSubtotal(item)
  let detail = ""
  switch (item.type) {
    case "labor":
      detail = `${item.laborHours ?? 0} hrs @ ${fmt(item.laborRate ?? 0)}/hr`
      break
    case "parts":
    case "paint":
      detail = `${item.partNumber ? `P/N: ${esc(item.partNumber)} · ` : ""}${item.quantity ?? 0} × ${fmt(item.unitPrice ?? 0)}`
      break
    case "sublet":
      detail = "Flat rate"
      break
  }
  return /* html */ `<tr id="line-item-${esc(item.id)}">
  <td><span class="badge badge-draft" style="font-size:0.65rem;">${esc(item.type)}</span></td>
  <td>
    <div>${esc(item.description)}</div>
    <div class="text-muted" style="font-size:0.78rem;">${detail}</div>
  </td>
  <td class="td-right text-muted" style="font-size:0.8rem;">${detail}</td>
  <td class="td-right">${fmt(sub)}</td>
  <td class="col-actions">
    <button class="btn btn-xs btn-danger"
      data-on:click="@delete('/sse/line-items/${esc(item.id)}')" title="Remove">✕</button>
  </td>
</tr>`
}

export function totalsRow(items: LineItem[], taxRate: number): string {
  const { subtotal, tax, total } = documentTotals(items, taxRate)
  const taxPct = (taxRate * 100).toFixed(1)
  return /* html */ `<tfoot id="totals-row">
  <tr>
    <td colspan="3" class="td-right text-muted">Subtotal</td>
    <td class="td-right">${fmt(subtotal)}</td>
    <td></td>
  </tr>
  ${taxRate > 0 ? `<tr>
    <td colspan="3" class="td-right text-muted">Tax (${taxPct}%)</td>
    <td class="td-right">${fmt(tax)}</td>
    <td></td>
  </tr>` : ""}
  <tr>
    <td colspan="3" class="td-right" style="font-size:1rem;">Total</td>
    <td class="td-right" style="font-size:1rem;color:var(--accent);">${fmt(total)}</td>
    <td></td>
  </tr>
</tfoot>`
}

// Read-only variant (no delete button) for public views
export function lineItemRowReadOnly(item: LineItem): string {
  const sub = lineItemSubtotal(item)
  let detail = ""
  switch (item.type) {
    case "labor":
      detail = `${item.laborHours ?? 0} hrs @ ${fmt(item.laborRate ?? 0)}/hr`
      break
    case "parts":
    case "paint":
      detail = `${item.partNumber ? `P/N: ${esc(item.partNumber)} · ` : ""}${item.quantity ?? 0} × ${fmt(item.unitPrice ?? 0)}`
      break
    case "sublet":
      detail = "Flat rate"
      break
  }
  return /* html */ `<tr>
  <td><span class="badge badge-draft" style="font-size:0.65rem;">${esc(item.type)}</span></td>
  <td>
    <div>${esc(item.description)}</div>
    <div class="text-muted" style="font-size:0.78rem;">${detail}</div>
  </td>
  <td class="td-right text-muted" style="font-size:0.8rem;">${detail}</td>
  <td class="td-right">${fmt(sub)}</td>
</tr>`
}
