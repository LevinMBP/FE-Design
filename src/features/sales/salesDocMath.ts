import dayjs from 'dayjs'
import type { Tax } from '../finance/types'
import type {
  DiscountType,
  DocTotals,
  InvoiceStatus,
  PaymentTerm,
  QuotationStatus,
  TaxBreakdownRow,
} from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

export const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

/** A line's tax treatment for the totals engine. */
export interface TotalsLine {
  quantity: number
  unitPrice: number
  /** Taxes this line attracts (ids into the provided tax list). */
  taxIds: string[]
  /** When true, unitPrice already contains the line's taxes. */
  taxIncluded: boolean
}

/**
 * Compute a document's money breakdown with per-line taxes.
 *
 * Each line carries its own tax selection (possibly several — e.g. 5% + 8%
 * instead of a single 13%). The line is reduced to a *net* (tax-excluded)
 * value: a tax-included line has its combined tax carved out
 * (price ÷ (1+rate)); otherwise the price is the net and tax is added on top.
 * Discount applies to the net subtotal, and every tax is scaled down by the
 * same proportion so the books stay consistent.
 *
 * Returns subtotal (net) → discount → gross → tax (with per-tax breakdown) → total.
 */
export function computeTotals(
  lines: TotalsLine[],
  discountType: DiscountType,
  discountValue: number,
  taxes: Tax[],
): DocTotals {
  const taxById = new Map(taxes.map((t) => [t.id, t]))
  const lineTaxes = (l: TotalsLine) =>
    (l.taxIds ?? []).map((id) => taxById.get(id)).filter((t): t is Tax => !!t)

  let net = 0
  // Per-tax amounts before the discount scales them down.
  const perTax = new Map<string, number>()
  for (const l of lines) {
    const amount = (l.quantity || 0) * (l.unitPrice || 0)
    const applied = lineTaxes(l)
    const combinedRate = applied.reduce((s, t) => s + t.rate, 0) / 100
    const lineNet = l.taxIncluded && combinedRate > 0 ? amount / (1 + combinedRate) : amount
    net += lineNet
    for (const t of applied) {
      perTax.set(t.id, (perTax.get(t.id) ?? 0) + lineNet * (t.rate / 100))
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

  const taxBreakdown: TaxBreakdownRow[] = [...perTax.entries()].map(([id, amt]) => {
    const t = taxById.get(id)!
    return { label: `${t.name} ${t.rate}%`, amount: round2(amt * (1 - discountFraction)) }
  })
  const taxAmount = round2(taxBreakdown.reduce((s, r) => s + r.amount, 0))
  const total = round2(gross + taxAmount)

  return { subtotal, discountAmount, gross, taxAmount, total, taxBreakdown }
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
