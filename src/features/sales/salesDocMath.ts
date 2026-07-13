import dayjs from 'dayjs'
import type { Tax } from '../finance/types'
import type {
  DiscountType,
  DocTotals,
  InvoiceStatus,
  PaymentTerm,
  QuotationStatus,
} from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

export const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

/** A line's tax treatment for the totals engine. */
export interface TotalsLine {
  quantity: number
  unitPrice: number
  /** When true, unitPrice already contains the document tax. */
  taxIncluded: boolean
}

/**
 * Compute a document's money breakdown with per-line tax treatment.
 *
 * Each line is reduced to a *net* (tax-excluded) value: a tax-included line has
 * its tax carved out (price ÷ (1+rate)); an excluded line's price is the net and
 * tax is added on top. Discount applies to the net subtotal, and the tax is
 * scaled down by the same proportion so the books stay consistent.
 *
 * Returns: subtotal (net) → discount → gross (net after discount) → tax → total.
 */
export function computeTotals(
  lines: TotalsLine[],
  discountType: DiscountType,
  discountValue: number,
  tax: Tax | undefined,
): DocTotals {
  const rate = tax?.rate ?? 0

  let net = 0
  let taxBeforeDiscount = 0
  for (const l of lines) {
    const amount = (l.quantity || 0) * (l.unitPrice || 0)
    if (rate && l.taxIncluded) {
      const lineNet = amount / (1 + rate / 100)
      net += lineNet
      taxBeforeDiscount += amount - lineNet
    } else if (rate) {
      net += amount
      taxBeforeDiscount += amount * (rate / 100)
    } else {
      net += amount
    }
  }

  const subtotal = round2(net)

  const rawDiscount =
    discountType === 'percent'
      ? subtotal * ((discountValue || 0) / 100)
      : discountValue || 0
  const discountAmount = round2(Math.min(Math.max(rawDiscount, 0), subtotal))

  const gross = round2(subtotal - discountAmount)
  const discountFraction = subtotal > 0 ? discountAmount / subtotal : 0
  const taxAmount = round2(taxBeforeDiscount * (1 - discountFraction))
  const total = round2(gross + taxAmount)

  return { subtotal, discountAmount, gross, taxAmount, total }
}

/** Net days for each payment term (0 = due immediately). */
const TERM_DAYS: Record<PaymentTerm, number> = {
  'Due on receipt': 0,
  'Net 7': 7,
  'Net 15': 15,
  'Net 30': 30,
  'Net 60': 60,
}

/** Due date = invoice date + the payment term's net days (ISO date). */
export function dueDateFrom(term: PaymentTerm, date: string): string {
  return dayjs(date).add(TERM_DAYS[term] ?? 0, 'day').format('YYYY-MM-DD')
}

/** Display label captured on a document, e.g. "VAT 12%" or "VAT 12% incl.". */
export function taxLabelOf(tax: Tax | undefined): string {
  if (!tax || !tax.rate) return 'No tax'
  return `${tax.name} ${tax.rate}%${tax.computation === 'inclusive' ? ' incl.' : ''}`
}

/** Active taxes that can apply to a sale (sales or both). */
export function isSalesTax(tax: Tax): boolean {
  return (
    tax.status === 'active' &&
    (tax.appliesTo === 'sales' || tax.appliesTo === 'both')
  )
}

/* ---- Status display (label + Ant Design Tag color) ---- */

export const QUOTATION_STATUS: Record<
  QuotationStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'default' },
  sent: { label: 'Sent', color: 'blue' },
  accepted: { label: 'Accepted', color: 'green' },
  declined: { label: 'Declined', color: 'red' },
  expired: { label: 'Expired', color: 'orange' },
  converted: { label: 'Converted', color: 'purple' },
}

export const INVOICE_STATUS: Record<
  InvoiceStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'default' },
  sent: { label: 'Unpaid', color: 'gold' },
  paid: { label: 'Paid', color: 'green' },
  void: { label: 'Void', color: 'red' },
}
