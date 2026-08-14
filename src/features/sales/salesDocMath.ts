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

/* ---- Amount in words (printed on documents that require it) ---- */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]
/** Scale words for each group of three digits, smallest first. */
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion']

/** 0–999 spelled out ('one hundred twenty-three'). */
function underThousand(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) {
    const rest = n % 10
    return TENS[Math.floor(n / 10)] + (rest ? `-${ONES[rest]}` : '')
  }
  const rest = n % 100
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${underThousand(rest)}` : ''}`
}

/** A whole number spelled out in English. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return 'zero'
  const groups: string[] = []
  let rest = n
  for (let scale = 0; rest > 0 && scale < SCALES.length; scale++) {
    const group = rest % 1000
    if (group) {
      groups.unshift(`${underThousand(group)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`)
    }
    rest = Math.floor(rest / 1000)
  }
  return groups.join(' ')
}

/**
 * A money amount as the sentence documents print, e.g.
 * `Eleven thousand eighty-eight pesos and 50/100 only`.
 */
export function amountInWords(value: number, major = 'pesos', minor = 'centavos'): string {
  const abs = Math.abs(value)
  const whole = Math.floor(abs)
  const cents = Math.round((abs - whole) * 100)
  const words = numberToWords(whole)
  const sentence = `${value < 0 ? 'minus ' : ''}${words} ${major}${
    cents ? ` and ${numberToWords(cents)} ${minor}` : ''
  } only`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

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
 * Strip tax out of a line amount when the price includes it, otherwise the
 * amount is already net. The single definition of "net", shared by the totals
 * engine and the sales-by-item report so a line is never valued two ways.
 */
const netOfAmount = (amount: number, combinedRate: number, taxIncluded: boolean) =>
  taxIncluded && combinedRate > 0 ? amount / (1 + combinedRate) : amount

/** Combined rate (as a fraction) of the taxes a line attracts. */
const combinedRateOf = (taxIds: string[] | undefined, taxes: Tax[]) =>
  (taxIds ?? []).reduce(
    (s, id) => s + (taxes.find((t) => t.id === id)?.rate ?? 0),
    0,
  ) / 100

/**
 * One line's net (tax-excluded, pre-discount) value — what the line contributes
 * to a document's subtotal. Used by reporting to split a document's revenue
 * back out per item.
 */
export function lineNetValue(line: TotalsLine, taxes: Tax[]): number {
  const amount = (line.quantity || 0) * (line.unitPrice || 0)
  return netOfAmount(amount, combinedRateOf(line.taxIds, taxes), line.taxIncluded)
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
    const lineNet = netOfAmount(amount, combinedRate, l.taxIncluded)
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
