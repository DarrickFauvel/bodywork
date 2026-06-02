import type { LineItem } from "../types"

export function lineItemSubtotal(item: LineItem): number {
  switch (item.type) {
    case "labor":
      return (item.laborHours ?? 0) * (item.laborRate ?? 0)
    case "parts":
    case "paint":
      return (item.quantity ?? 0) * (item.unitPrice ?? 0)
    case "sublet":
      return item.flatPrice ?? 0
    default:
      return 0
  }
}

export function documentTotals(items: LineItem[], taxRate: number) {
  const subtotal = items.reduce((sum, i) => sum + lineItemSubtotal(i), 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  return { subtotal, tax, total }
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}
