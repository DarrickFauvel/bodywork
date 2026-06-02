import type { User } from "better-auth"

export type AppVariables = {
  user: User
  plan: string
  isSuperAdmin: boolean
}

export type EstimateStatus = "draft" | "sent" | "approved" | "declined"
export type InvoiceStatus = "draft" | "sent" | "paid"
export type LineItemType = "labor" | "parts" | "paint" | "sublet"

export interface VehicleInfo {
  year: string
  make: string
  model: string
  vin: string
  color: string
  mileage: string
}

export interface Settings {
  id: string
  shopName: string | null
  phone: string | null
  email: string | null
  address: string | null
  defaultLaborRate: number
  defaultTaxRate: number
  updatedAt: number | null
}

export interface Customer {
  id: string
  ownerId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  createdAt: number
  updatedAt: number
}

export interface Estimate {
  id: string
  ownerId: string
  customerId: string
  status: EstimateStatus
  title: string
  vehicleInfo: string | null
  notes: string | null
  taxRate: number
  shareToken: string | null
  sentAt: number | null
  approvedAt: number | null
  declinedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Invoice {
  id: string
  ownerId: string
  estimateId: string | null
  customerId: string
  status: InvoiceStatus
  title: string
  vehicleInfo: string | null
  notes: string | null
  taxRate: number
  shareToken: string | null
  dueDate: number | null
  sentAt: number | null
  paidAt: number | null
  createdAt: number
  updatedAt: number
}

export interface LineItem {
  id: string
  estimateId: string | null
  invoiceId: string | null
  type: LineItemType
  sortOrder: number
  description: string
  laborHours: number | null
  laborRate: number | null
  partNumber: string | null
  quantity: number | null
  unitPrice: number | null
  flatPrice: number | null
  createdAt: number
  updatedAt: number
}

export interface EstimateWithCustomer extends Estimate {
  customerName: string
}

export interface InvoiceWithCustomer extends Invoice {
  customerName: string
}
