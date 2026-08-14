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
  /** Running total collected against this invoice (0 until a collection lands). */
  amountPaid: number
}

/* ------------------------------------------------------------------ *
 * Collections — the AR settlement document, mirroring vendor payments: *
 *                                                                      *
 *   customer → allocation → invoice / sales order                      *
 *                                                                      *
 * Both invoices and sales orders debit Accounts Receivable when they're *
 * booked, so both are collectible; a collection can settle either.      *
 * ------------------------------------------------------------------ */

export type ReceivableKind = 'invoice' | 'sale'

export const RECEIVABLE_KIND_LABELS: Record<ReceivableKind, string> = {
  invoice: 'Invoice',
  sale: 'Sales Order',
}

/** An invoice or sales order flattened to what settlement cares about. */
export interface OpenReceivable {
  kind: ReceivableKind
  id: string
  reference: string
  date: string
  dueDate: string // '' when the document has no term (sales orders)
  customerId: string
  customerName: string
  total: number
  /** Tax-exclusive value (after discount) — the base withholding is computed on. */
  netBase: number
  amountPaid: number
  outstanding: number
}

/** One document a collection was applied to, and for how much. */
export interface CollectionAllocation {
  docKind: ReceivableKind
  docId: string
  docRef: string
  docDate: string
  /** The document's total at the time of allocation (for the audit trail). */
  docTotal: number
  /** What this line settles on the document — cash plus any tax withheld. */
  amount: number
  /** Tax the customer withheld and remitted for you (creditable on your return). */
  withholdingTax: number
}

/**
 * A customer collection: money received from ONE customer on one date through
 * one payment method, allocated across that customer's open documents.
 * `amount` is always Σ allocations.
 *
 * Withholding works the same way as on a vendor payment, in reverse: the
 * customer settles the document in full by `amount` but only remits
 * `cashAmount`, keeping the balance back as tax. The withheld portion is a
 * creditable asset, evidenced by the 2307 they issue you.
 */
export interface Collection {
  id: string
  reference: string // COL-001
  date: string
  customerId: string
  customerName: string
  paymentMethodId: string
  paymentMethodName: string
  note: string
  allocations: CollectionAllocation[]
  amount: number // Σ allocations — what the receivables were relieved by
  withholdingTaxId?: string
  withholdingLabel?: string // e.g. "Creditable WHT (Sales) 1%"
  withholdingTotal: number // Σ tax withheld by the customer
  cashAmount: number // amount − withholdingTotal — what actually landed
}

/** One line of a collection as submitted from the form. */
export interface CollectionAllocationInput {
  docKind: ReceivableKind
  docId: string
  amount: number
  /** Withheld from this line; must not exceed `amount`. Defaults to 0. */
  withholdingTax?: number
}

export interface NewCollection {
  date: string
  customerId: string
  paymentMethodId: string
  note: string
  /** The withholding tax applied — required once any line withholds. */
  withholdingTaxId?: string
  allocations: CollectionAllocationInput[]
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
