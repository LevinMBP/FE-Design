import type { StockItemKind } from '../inventory/types'

/**
 * Sales documents — Quotations and Invoices. A Quotation is a non-binding offer
 * (no stock impact) that can be converted into an Invoice. Issuing an Invoice
 * reduces inventory — the invoice IS the sale (see `mockSalesDocs.ts`).
 *
 * Both capture a snapshot of the customer's contact details and per-line tax
 * treatment, so a document stays self-contained even if master data changes.
 */

export type DiscountType = 'amount' | 'percent'

/** One priced line. `taxIds` are the taxes this line attracts; `taxIncluded`
    means the unit price already contains those taxes. */
export interface SalesDocLine {
  itemKind: StockItemKind
  itemId: string
  itemName: string
  unit: string
  packaging: string
  description: string
  quantity: number
  unitPrice: number
  taxIds: string[]
  taxIncluded: boolean
}

/** One tax's share of a document's total, e.g. { label: 'VAT 12%', amount: 120 }. */
export interface TaxBreakdownRow {
  label: string
  amount: number
}

/** The money breakdown shared by both document kinds. */
export interface DocTotals {
  subtotal: number // net of tax, before discount
  discountAmount: number // resolved discount in currency
  gross: number // net after discount (the taxable base)
  taxAmount: number // tax on the discounted base
  total: number // amount payable
  taxBreakdown: TaxBreakdownRow[] // per-tax split of taxAmount
}

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'converted'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

/** Payment terms offered on an invoice; drives the due date. */
export const PAYMENT_TERMS = [
  'Due on receipt',
  'Net 7',
  'Net 15',
  'Net 30',
  'Net 60',
] as const
export type PaymentTerm = (typeof PAYMENT_TERMS)[number]

/** The single stock location available for now (see Locations, coming later). */
export const INVENTORY_LOCATIONS = ['Main Warehouse'] as const

interface SalesDocBase extends DocTotals {
  id: string
  reference: string
  date: string // ISO date
  customerId: string
  customerName: string
  // Snapshot of the customer's contact block at creation.
  contactPerson: string
  email: string
  address: string
  lines: SalesDocLine[]
  discountType: DiscountType
  discountValue: number
  notes: string
}

/** A signatory on a document: printed name + drawn signature (PNG data URL). */
export interface SignatureBlock {
  name: string
  signature: string
}

export interface Quotation extends SalesDocBase {
  reference: string // QUO-001
  effectiveDate: string // ISO date
  expiryDate: string // ISO date (defaults to date + 3 months)
  status: QuotationStatus
  convertedInvoiceId?: string
  preparedBy?: SignatureBlock
  approvedBy?: SignatureBlock
}

export interface Invoice extends SalesDocBase {
  reference: string // INV-001
  deliveryReceipt: string // DR number / reference (not a date)
  paymentTerm: PaymentTerm
  dueDate: string // derived from date + payment term
  location: string
  status: InvoiceStatus
  issued: boolean
  quotationId?: string
}

/** A line as submitted from a form (names/units resolved on save). */
export interface SalesDocLineInput {
  itemKind: StockItemKind
  itemId: string
  quantity: number
  unitPrice: number
  taxIds: string[]
  taxIncluded: boolean
  packaging: string
  description: string
}

interface NewSalesDocBase {
  customerId: string
  contactPerson: string
  email: string
  address: string
  lines: SalesDocLineInput[]
  discountType: DiscountType
  discountValue: number
  notes: string
}

export interface NewQuotation extends NewSalesDocBase {
  date: string
  effectiveDate: string
  expiryDate: string
  status: 'draft' | 'sent'
  preparedBy?: SignatureBlock
  approvedBy?: SignatureBlock
}

export interface NewInvoice extends NewSalesDocBase {
  date: string
  deliveryReceipt: string
  paymentTerm: PaymentTerm
  location: string
  status: 'draft' | 'sent'
  quotationId?: string
}
