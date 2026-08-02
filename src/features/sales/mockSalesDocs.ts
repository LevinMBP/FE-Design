import dayjs from 'dayjs'
import { getStockItemRef } from '../inventory/mockInventory'
import { issueStockOut } from '../inventory/issueStock'
import { postSaleEntries } from '../accounting/autoPost'
import { listCustomers } from '../contacts/mockContacts'
import { listTaxes } from '../finance/mockFinance'
import { computeTotals, dueDateFrom } from './salesDocMath'
import { INVENTORY_LOCATIONS } from './types'
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
const pad4 = (n: number) => String(n).padStart(4, '0')
/** Two-digit year of an ISO date, e.g. '2026-07-16' → '26'. */
const shortYear = (isoDate: string) => isoDate.slice(2, 4)

let quotations: Quotation[] = []
let quoNo = 0
let invoices: Invoice[] = []
let invNo = 0
/** Bumps whenever an invoice is created or changes state — a cache key for
    derived reports, which must not serve figures from before the change. */
let invoiceVersion = 0

export function invoicesVersion(): number {
  return invoiceVersion
}

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
      taxIds: l.taxIds ?? [],
      taxIncluded: l.taxIncluded,
    }
  })
}

function priceOut(
  lines: SalesDocLine[],
  discountType: DiscountType,
  discountValue: number,
): DocTotals {
  return computeTotals(lines, discountType, discountValue, listTaxes())
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
  const totals = priceOut(lines, input.discountType, input.discountValue)
  const record: Quotation = {
    id: uid('quo'),
    reference: `QUO-${pad4(++quoNo)}-${shortYear(input.date)}`,
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
    notes: input.notes,
    status: input.status,
    preparedBy: input.preparedBy,
    approvedBy: input.approvedBy,
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
  const totals = priceOut(lines, input.discountType, input.discountValue)
  const reference = `INV-${pad4(++invNo)}-${shortYear(input.date)}`
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
    notes: input.notes,
    status: input.status,
    issued,
    quotationId: input.quotationId,
    ...totals,
  }
  invoices = [record, ...invoices]
  invoiceVersion++

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
  invoiceVersion++
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
  invoiceVersion++
  return invoices.find((i) => i.id === id)!
}

/* ----------------------------- Seed data ----------------------------- */

const iso = (daysFromToday: number) =>
  dayjs().add(daysFromToday, 'day').format('YYYY-MM-DD')

/** Create a quotation through the normal path, then move it along its lifecycle. */
function seedQuotation(input: NewQuotation, finalStatus?: QuotationStatus): Quotation {
  const q = createQuotation(input)
  if (finalStatus && finalStatus !== q.status) return setQuotationStatus(q.id, finalStatus)
  return q
}

// Oldest first so QUO numbering reads naturally (QUO-0001-26 = oldest).
seedQuotation(
  {
    date: iso(-45),
    effectiveDate: iso(-45),
    expiryDate: iso(-15),
    customerId: 'cus_acme',
    contactPerson: 'Alice Reyes',
    email: 'alice@acmeretail.com',
    address: '12 Ayala Ave, Unit 4B, Makati, Metro Manila 1226',
    lines: [
      { itemKind: 'product', itemId: 'prd_drill', quantity: 6, unitPrice: 95, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Box', description: 'Trial order for new branch' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: 'Superseded by a newer offer.',
    status: 'sent',
  },
  'expired',
)

// Accepted then billed — its invoice is seeded below, which flips it to 'converted'.
const convertedQuote = seedQuotation(
  {
    date: iso(-32),
    effectiveDate: iso(-32),
    expiryDate: iso(58),
    customerId: 'cus_luzon',
    contactPerson: 'Carla Santos',
    email: 'carla@luzondist.ph',
    address: '5 Session Rd, Baguio, Benguet 2600',
    lines: [
      { itemKind: 'product', itemId: 'prd_hinges', quantity: 60, unitPrice: 3.5, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Pack of 10', description: 'Hardware for the Baguio fit-out' },
      { itemKind: 'product', itemId: 'prd_table', quantity: 2, unitPrice: 140, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Flat-pack carton', description: '' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: 'Accepted by phone; billed on delivery.',
    status: 'sent',
  },
  'accepted',
)

seedQuotation(
  {
    date: iso(-20),
    effectiveDate: iso(-20),
    expiryDate: iso(70),
    customerId: 'cus_north',
    contactPerson: 'Ben Cruz',
    email: 'ben@northwind.co',
    address: '88 Ortigas Center, Pasig, Metro Manila 1605',
    lines: [
      { itemKind: 'product', itemId: 'prd_cabinet', quantity: 4, unitPrice: 220, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Crate', description: 'Office storage refresh' },
      { itemKind: 'product', itemId: 'prd_hinges', quantity: 40, unitPrice: 3.5, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Pack of 10', description: '' },
    ],
    discountType: 'percent',
    discountValue: 5,
    notes: 'Volume discount applied per account manager.',
    status: 'sent',
  },
  'accepted',
)

seedQuotation(
  {
    date: iso(-12),
    effectiveDate: iso(-12),
    expiryDate: iso(78),
    customerId: 'cus_luzon',
    contactPerson: 'Carla Santos',
    email: 'carla@luzondist.ph',
    address: '5 Session Rd, Baguio, Benguet 2600',
    lines: [
      { itemKind: 'product', itemId: 'prd_table', quantity: 10, unitPrice: 140, taxIds: ['tax_vat_zero'], taxIncluded: false, packaging: 'Flat-pack carton', description: 'Café seating project' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: '',
    status: 'sent',
  },
  'declined',
)

seedQuotation(
  {
    date: iso(-5),
    effectiveDate: iso(-5),
    expiryDate: iso(85),
    customerId: 'cus_acme',
    contactPerson: 'Alice Reyes',
    email: 'alice@acmeretail.com',
    address: '12 Ayala Ave, Unit 4B, Makati, Metro Manila 1226',
    lines: [
      { itemKind: 'product', itemId: 'prd_cabinet', quantity: 2, unitPrice: 220, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Crate', description: '' },
      { itemKind: 'product', itemId: 'prd_table', quantity: 5, unitPrice: 140, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Flat-pack carton', description: 'Matte white finish' },
      { itemKind: 'material', itemId: 'mat_paint', quantity: 4, unitPrice: 12, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Can', description: 'Touch-up paint included' },
    ],
    discountType: 'amount',
    discountValue: 100,
    notes: 'Delivery within 10 business days of acceptance.',
    status: 'sent',
  },
)

seedQuotation({
  date: iso(-1),
  effectiveDate: iso(-1),
  expiryDate: iso(89),
  customerId: 'cus_north',
  contactPerson: 'Ben Cruz',
  email: 'ben@northwind.co',
  address: '88 Ortigas Center, Pasig, Metro Manila 1605',
  lines: [
    { itemKind: 'product', itemId: 'prd_drill', quantity: 12, unitPrice: 90, taxIds: ['tax_vat'], taxIncluded: true, packaging: 'Box', description: 'Price includes VAT' },
  ],
  discountType: 'amount',
  discountValue: 0,
  notes: 'Draft — pending pricing approval.',
  status: 'draft',
})

/**
 * Invoices, seeded through `createInvoice` so everything a real entry touches
 * moves too: an invoice seeded as 'sent' issues its stock and posts the revenue,
 * output tax and COGS entries. Quantities stay well inside each item's opening
 * stock so seeding can never fail on availability. Oldest first, so INV
 * numbering reads naturally (INV-0001-26 = oldest).
 */
function seedInvoice(input: NewInvoice, paid = false): Invoice {
  const inv = createInvoice(input)
  return paid ? markInvoicePaid(inv.id) : inv
}

const MAIN = INVENTORY_LOCATIONS[0]

// Earlier months, so the monthly breakdown has a history to accumulate over.
seedInvoice(
  {
    date: iso(-190),
    deliveryReceipt: 'DR-0912',
    paymentTerm: 'Net 30',
    location: MAIN,
    customerId: 'cus_acme',
    contactPerson: 'Alice Reyes',
    email: 'alice@acmeretail.com',
    address: '12 Ayala Ave, Unit 4B, Makati, Metro Manila 1226',
    lines: [
      { itemKind: 'product', itemId: 'prd_drill', quantity: 3, unitPrice: 95, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Box', description: '' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: '',
    status: 'sent',
  },
  true,
)

seedInvoice(
  {
    date: iso(-160),
    deliveryReceipt: 'DR-0948',
    paymentTerm: 'Net 30',
    location: MAIN,
    customerId: 'cus_north',
    contactPerson: 'Ben Cruz',
    email: 'ben@northwind.co',
    address: '88 Ortigas Center, Pasig, Metro Manila 1605',
    lines: [
      { itemKind: 'product', itemId: 'prd_cabinet', quantity: 2, unitPrice: 220, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Crate', description: 'Records room' },
      { itemKind: 'product', itemId: 'prd_hinges', quantity: 50, unitPrice: 3.5, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Pack of 10', description: '' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: '',
    status: 'sent',
  },
  true,
)

seedInvoice(
  {
    date: iso(-125),
    deliveryReceipt: 'DR-0977',
    paymentTerm: 'Net 15',
    location: MAIN,
    customerId: 'cus_luzon',
    contactPerson: 'Carla Santos',
    email: 'carla@luzondist.ph',
    address: '5 Session Rd, Baguio, Benguet 2600',
    lines: [
      { itemKind: 'product', itemId: 'prd_table', quantity: 2, unitPrice: 140, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Flat-pack carton', description: '' },
      { itemKind: 'material', itemId: 'mat_paint', quantity: 4, unitPrice: 12, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Can', description: '' },
    ],
    discountType: 'percent',
    discountValue: 10,
    notes: 'Opening-order discount.',
    status: 'sent',
  },
  true,
)

seedInvoice(
  {
    date: iso(-95),
    deliveryReceipt: 'DR-1002',
    paymentTerm: 'Net 30',
    location: MAIN,
    customerId: 'cus_north',
    contactPerson: 'Ben Cruz',
    email: 'ben@northwind.co',
    address: '88 Ortigas Center, Pasig, Metro Manila 1605',
    lines: [
      { itemKind: 'product', itemId: 'prd_drill', quantity: 5, unitPrice: 90, taxIds: ['tax_vat'], taxIncluded: true, packaging: 'Box', description: 'Price includes VAT' },
      { itemKind: 'product', itemId: 'prd_hinges', quantity: 20, unitPrice: 3.5, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Pack of 10', description: '' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: '',
    status: 'sent',
  },
  true,
)

seedInvoice(
  {
    date: iso(-70),
    deliveryReceipt: 'DR-1024',
    paymentTerm: 'Net 15',
    location: MAIN,
    customerId: 'cus_acme',
    contactPerson: 'Alice Reyes',
    email: 'alice@acmeretail.com',
    address: '12 Ayala Ave, Unit 4B, Makati, Metro Manila 1226',
    lines: [
      { itemKind: 'product', itemId: 'prd_cabinet', quantity: 3, unitPrice: 220, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Crate', description: 'Branch fit-out' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: '',
    status: 'sent',
  },
  true,
)

// Settled a while back.
seedInvoice(
  {
    date: iso(-38),
    deliveryReceipt: 'DR-1041',
    paymentTerm: 'Net 15',
    location: MAIN,
    customerId: 'cus_acme',
    contactPerson: 'Alice Reyes',
    email: 'alice@acmeretail.com',
    address: '12 Ayala Ave, Unit 4B, Makati, Metro Manila 1226',
    lines: [
      { itemKind: 'product', itemId: 'prd_drill', quantity: 4, unitPrice: 95, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Box', description: 'Store floor replenishment' },
    ],
    discountType: 'amount',
    discountValue: 0,
    notes: 'Paid by bank transfer.',
    status: 'sent',
  },
  true,
)

// Billed off the accepted quotation above, which this flips to 'converted'.
seedInvoice(
  {
    date: iso(-30),
    deliveryReceipt: 'DR-1058',
    paymentTerm: 'Net 30',
    location: MAIN,
    customerId: convertedQuote.customerId,
    contactPerson: convertedQuote.contactPerson,
    email: convertedQuote.email,
    address: convertedQuote.address,
    lines: convertedQuote.lines.map((l) => ({
      itemKind: l.itemKind,
      itemId: l.itemId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxIds: l.taxIds,
      taxIncluded: l.taxIncluded,
      packaging: l.packaging,
      description: l.description,
    })),
    discountType: convertedQuote.discountType,
    discountValue: convertedQuote.discountValue,
    notes: `Converted from ${convertedQuote.reference}.`,
    status: 'sent',
    quotationId: convertedQuote.id,
  },
  true,
)

// Overdue — Net 7 on an invoice sent nine days ago.
seedInvoice({
  date: iso(-9),
  deliveryReceipt: 'DR-1072',
  paymentTerm: 'Net 7',
  location: MAIN,
  customerId: 'cus_acme',
  contactPerson: 'Alice Reyes',
  email: 'alice@acmeretail.com',
  address: '12 Ayala Ave, Unit 4B, Makati, Metro Manila 1226',
  lines: [
    { itemKind: 'product', itemId: 'prd_cabinet', quantity: 3, unitPrice: 220, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Crate', description: 'Back-office storage' },
    { itemKind: 'material', itemId: 'mat_paint', quantity: 6, unitPrice: 12, taxIds: ['tax_vat'], taxIncluded: false, packaging: 'Can', description: 'Touch-up paint' },
  ],
  discountType: 'percent',
  discountValue: 5,
  notes: 'Second follow-up sent.',
  status: 'sent',
})

// Open and not yet due; VAT-inclusive pricing.
seedInvoice({
  date: iso(-2),
  deliveryReceipt: 'DR-1080',
  paymentTerm: 'Net 30',
  location: MAIN,
  customerId: 'cus_north',
  contactPerson: 'Ben Cruz',
  email: 'ben@northwind.co',
  address: '88 Ortigas Center, Pasig, Metro Manila 1605',
  lines: [
    { itemKind: 'product', itemId: 'prd_drill', quantity: 8, unitPrice: 90, taxIds: ['tax_vat'], taxIncluded: true, packaging: 'Box', description: 'Price includes VAT' },
    { itemKind: 'product', itemId: 'prd_hinges', quantity: 40, unitPrice: 3.36, taxIds: ['tax_vat'], taxIncluded: true, packaging: 'Pack of 10', description: '' },
  ],
  discountType: 'amount',
  discountValue: 0,
  notes: '',
  status: 'sent',
})

// Draft — nothing issued yet; sending it deducts the stock.
seedInvoice({
  date: iso(0),
  deliveryReceipt: '',
  paymentTerm: 'Net 60',
  location: MAIN,
  customerId: 'cus_luzon',
  contactPerson: 'Carla Santos',
  email: 'carla@luzondist.ph',
  address: '5 Session Rd, Baguio, Benguet 2600',
  lines: [
    { itemKind: 'product', itemId: 'prd_table', quantity: 3, unitPrice: 140, taxIds: ['tax_vat_zero'], taxIncluded: false, packaging: 'Flat-pack carton', description: 'Zero-rated export order' },
  ],
  discountType: 'amount',
  discountValue: 0,
  notes: 'Awaiting export paperwork before release.',
  status: 'draft',
})
