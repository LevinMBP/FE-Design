import { getStockItemRef } from '../inventory/mockInventory'
import { issueStockOut } from '../inventory/issueStock'
import { postSaleEntries } from '../accounting/autoPost'
import { listCustomers } from '../contacts/mockContacts'
import { listTaxes } from '../finance/mockFinance'
import { computeTotals, dueDateFrom, taxLabelOf } from './salesDocMath'
import type {
  DiscountType,
  DocTotals,
  Invoice,
  NewInvoice,
  NewQuotation,
  Quotation,
  QuotationStatus,
  SalesDocLine,
  SalesDocLineInput,
} from './types'

/**
 * In-memory store for sales documents. Quotations are pure paperwork (no stock
 * impact). Invoices reduce inventory the moment they're *issued* (created as
 * "sent" or sent from draft) — routed through the shared `issueStockOut`, so an
 * invoice is a sale for stock purposes. Resets on reload.
 */

const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`
const pad3 = (n: number) => String(n).padStart(3, '0')

let quotations: Quotation[] = []
let quoNo = 0
let invoices: Invoice[] = []
let invNo = 0

/** Resolve form line inputs to full lines (names/units), rejecting empties. */
function resolveLines(inputs: SalesDocLineInput[]): SalesDocLine[] {
  const usable = inputs.filter((l) => l.itemId && l.quantity > 0)
  if (usable.length === 0) {
    throw new Error('Add at least one item with a quantity.')
  }
  return usable.map((l) => {
    const ref = getStockItemRef(l.itemKind, l.itemId)
    if (!ref) throw new Error('A selected item no longer exists.')
    return {
      itemKind: l.itemKind,
      itemId: l.itemId,
      itemName: ref.name,
      unit: ref.unit,
      packaging: l.packaging ?? '',
      description: l.description ?? '',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxIncluded: l.taxIncluded,
    }
  })
}

function priceOut(
  lines: SalesDocLine[],
  discountType: DiscountType,
  discountValue: number,
  taxId: string,
): { totals: DocTotals; taxLabel: string } {
  const tax = listTaxes().find((t) => t.id === taxId)
  return {
    totals: computeTotals(lines, discountType, discountValue, tax),
    taxLabel: taxLabelOf(tax),
  }
}

const customerName = (id: string) =>
  listCustomers().find((c) => c.id === id)?.company ?? ''

/* --------------------------- Quotations --------------------------- */

export function listQuotations(): Quotation[] {
  return [...quotations]
}

export function getQuotation(id: string): Quotation | undefined {
  return quotations.find((q) => q.id === id)
}

export function createQuotation(input: NewQuotation): Quotation {
  const lines = resolveLines(input.lines)
  const { totals, taxLabel } = priceOut(
    lines,
    input.discountType,
    input.discountValue,
    input.taxId,
  )
  const record: Quotation = {
    id: uid('quo'),
    reference: `QUO-${pad3(++quoNo)}`,
    date: input.date,
    effectiveDate: input.effectiveDate,
    expiryDate: input.expiryDate,
    customerId: input.customerId,
    customerName: customerName(input.customerId),
    contactPerson: input.contactPerson,
    email: input.email,
    address: input.address,
    lines,
    discountType: input.discountType,
    discountValue: input.discountValue,
    taxId: input.taxId,
    taxLabel,
    notes: input.notes,
    status: input.status,
    ...totals,
  }
  quotations = [record, ...quotations]
  return record
}

/** Move a quotation along its lifecycle (sent / accepted / declined / expired). */
export function setQuotationStatus(
  id: string,
  status: QuotationStatus,
): Quotation {
  const quote = quotations.find((q) => q.id === id)
  if (!quote) throw new Error('Quotation not found.')
  if (quote.status === 'converted') {
    throw new Error('This quotation has already been converted to an invoice.')
  }
  quotations = quotations.map((q) => (q.id === id ? { ...q, status } : q))
  return quotations.find((q) => q.id === id)!
}

/* ---------------------------- Invoices ---------------------------- */

export function listInvoices(): Invoice[] {
  return [...invoices]
}

export function createInvoice(input: NewInvoice): Invoice {
  const lines = resolveLines(input.lines)
  const { totals, taxLabel } = priceOut(
    lines,
    input.discountType,
    input.discountValue,
    input.taxId,
  )
  const reference = `INV-${pad3(++invNo)}`
  const issued = input.status === 'sent'

  // Issuing an invoice deducts stock — the invoice is the sale — and posts the
  // revenue + COGS journal entries.
  if (issued) {
    const cogsCost = issueStockOut(
      lines.map((l) => ({
        itemKind: l.itemKind,
        itemId: l.itemId,
        quantity: l.quantity,
      })),
      input.date,
      reference,
    )
    postSaleEntries({
      date: input.date,
      reference,
      party: customerName(input.customerId),
      revenueNet: totals.gross,
      taxAmount: totals.taxAmount,
      cogsCost,
    })
  }

  const record: Invoice = {
    id: uid('inv'),
    reference,
    date: input.date,
    deliveryReceipt: input.deliveryReceipt,
    paymentTerm: input.paymentTerm,
    dueDate: dueDateFrom(input.paymentTerm, input.date),
    location: input.location,
    customerId: input.customerId,
    customerName: customerName(input.customerId),
    contactPerson: input.contactPerson,
    email: input.email,
    address: input.address,
    lines,
    discountType: input.discountType,
    discountValue: input.discountValue,
    taxId: input.taxId,
    taxLabel,
    notes: input.notes,
    status: input.status,
    issued,
    quotationId: input.quotationId,
    ...totals,
  }
  invoices = [record, ...invoices]

  // Mark the origin quotation converted so it can't be reused.
  if (input.quotationId) {
    quotations = quotations.map((q) =>
      q.id === input.quotationId
        ? { ...q, status: 'converted', convertedInvoiceId: record.id }
        : q,
    )
  }
  return record
}

/** Issue a draft invoice: deduct stock now and mark it unpaid (sent). */
export function sendInvoice(id: string): Invoice {
  const inv = invoices.find((i) => i.id === id)
  if (!inv) throw new Error('Invoice not found.')
  if (inv.issued) return inv
  const cogsCost = issueStockOut(
    inv.lines.map((l) => ({
      itemKind: l.itemKind,
      itemId: l.itemId,
      quantity: l.quantity,
    })),
    inv.date,
    inv.reference,
  )
  postSaleEntries({
    date: inv.date,
    reference: inv.reference,
    party: inv.customerName,
    revenueNet: inv.gross,
    taxAmount: inv.taxAmount,
    cogsCost,
  })
  invoices = invoices.map((i) =>
    i.id === id ? { ...i, status: 'sent', issued: true } : i,
  )
  return invoices.find((i) => i.id === id)!
}

/** Record payment on an issued invoice. */
export function markInvoicePaid(id: string): Invoice {
  const inv = invoices.find((i) => i.id === id)
  if (!inv) throw new Error('Invoice not found.')
  if (!inv.issued) {
    throw new Error('Send the invoice before marking it paid.')
  }
  invoices = invoices.map((i) => (i.id === id ? { ...i, status: 'paid' } : i))
  return invoices.find((i) => i.id === id)!
}
