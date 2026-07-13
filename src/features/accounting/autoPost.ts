import { addJournalEntry } from './mockAccounting'
import type { JournalLine } from './types'

/**
 * Automatic double-entry postings for stock transactions. Every purchase and
 * every sale/issued invoice posts a balanced journal entry here, so the books
 * move without manual entry. Sales recognise revenue (net of tax) plus output
 * tax, and separately relieve inventory into COGS at FIFO cost.
 *
 * Defaults assume on-account trade (Accounts Payable / Receivable). Settlement
 * (cash in/out) is a separate event.
 */

const ACC = {
  ar: 'acc_ar',
  inv: 'acc_inv',
  ppe: 'acc_ppe',
  opex: 'acc_opex',
  ap: 'acc_ap',
  wht: 'acc_wht',
  vatIn: 'acc_vat_in',
  sales: 'acc_sales',
  cogs: 'acc_cogs',
  vatOut: 'acc_vat_out',
  obe: 'acc_obe',
  adj: 'acc_adj',
} as const

/** Which account a purchase debits, by its type. */
export const PURCHASE_DEBIT_ACCOUNT = {
  material: ACC.inv,
  product: ACC.inv,
  asset: ACC.ppe,
  service: ACC.opex,
  expense: ACC.opex,
} as const

const round2 = (n: number) => Math.round(n * 100) / 100
const dr = (accountId: string, amount: number): JournalLine => ({
  accountId,
  debit: round2(amount),
  credit: 0,
})
const cr = (accountId: string, amount: number): JournalLine => ({
  accountId,
  debit: 0,
  credit: round2(amount),
})

const suffix = (party: string) => (party ? ` — ${party}` : '')

/**
 * Purchase on account. Debits each type's account (Inventory, Property &
 * Equipment, or Operating Expenses) for that type's share of the goods/services
 * value, debits Input Tax Receivable for any added-on tax, and credits Accounts
 * Payable for the full amount owed:
 *   Dr <account(s)> subtotal / Dr Input Tax / Cr AP (subtotal + tax).
 * `debits` are the per-type subtotals already grouped by account.
 */
export function postPurchaseEntry(opts: {
  date: string
  reference: string
  party: string
  debits: { accountId: string; amount: number }[]
  inputTax: number
  total: number
}): void {
  if (opts.total <= 0) return
  const lines: JournalLine[] = opts.debits
    .filter((d) => d.amount > 0)
    .map((d) => dr(d.accountId, d.amount))
  if (opts.inputTax > 0) lines.push(dr(ACC.vatIn, opts.inputTax))
  lines.push(cr(ACC.ap, opts.total))
  addJournalEntry({
    date: opts.date,
    memo: `Purchase ${opts.reference}${suffix(opts.party)}`,
    lines,
  })
}

/**
 * Vendor payment — settling a purchase's payable. Reduces what you owe and the
 * cash/bank the payment method draws from:  Dr Accounts Payable / Cr <cash|bank>.
 * Withholding was already split off at purchase time, so this only clears the
 * net payable.
 */
export function postVendorPaymentEntry(opts: {
  date: string
  reference: string
  party: string
  amount: number
  creditAccountId: string
}): void {
  if (opts.amount <= 0) return
  addJournalEntry({
    date: opts.date,
    memo: `Payment ${opts.reference}${suffix(opts.party)}`,
    lines: [dr(ACC.ap, opts.amount), cr(opts.creditAccountId, opts.amount)],
  })
}

/**
 * Opening inventory balance (from an Opening Balance document at onboarding).
 * Opening stock has no counterparty and no cash outflow, so the credit goes to
 * equity, not Accounts Payable:  Dr Inventory / Cr Opening Balance Equity.
 */
export function postOpeningBalanceEntry(opts: {
  date: string
  totalValue: number
}): void {
  if (opts.totalValue <= 0) return
  addJournalEntry({
    date: opts.date,
    memo: 'Opening inventory balance',
    lines: [dr(ACC.inv, opts.totalValue), cr(ACC.obe, opts.totalValue)],
  })
}

/**
 * Stock adjustment (from an Audits & Adjustments correction). The net change in
 * inventory value is offset to a single Inventory Adjustments expense account, so
 * write-downs land as a loss and found stock nets against it:
 *   net > 0 (stock up):   Dr Inventory / Cr Inventory Adjustments
 *   net < 0 (stock down): Dr Inventory Adjustments / Cr Inventory
 * `netValue` = value added − value removed, so the Inventory account moves by
 * exactly the same amount the FIFO subledger did (the two stay reconciled).
 */
export function postAdjustmentEntry(opts: {
  date: string
  reference: string
  netValue: number
}): void {
  const amount = round2(Math.abs(opts.netValue))
  if (amount < 0.005) return
  const lines =
    opts.netValue > 0
      ? [dr(ACC.inv, amount), cr(ACC.adj, amount)]
      : [dr(ACC.adj, amount), cr(ACC.inv, amount)]
  addJournalEntry({
    date: opts.date,
    memo: `Stock adjustment ${opts.reference}`,
    lines,
  })
}

/**
 * Sale / issued invoice. Posts up to two entries:
 *  1. Revenue — Dr AR (gross incl. tax) / Cr Sales (net) / Cr Output Tax.
 *  2. COGS    — Dr Cost of Goods Sold / Cr Inventory (FIFO cost).
 */
export function postSaleEntries(opts: {
  date: string
  reference: string
  party: string
  revenueNet: number // amount recognised as sales (net of tax, after discount)
  taxAmount: number
  cogsCost: number
}): void {
  const receivable = round2(opts.revenueNet + opts.taxAmount)
  if (receivable > 0) {
    const lines = [dr(ACC.ar, receivable), cr(ACC.sales, opts.revenueNet)]
    if (opts.taxAmount > 0) lines.push(cr(ACC.vatOut, opts.taxAmount))
    addJournalEntry({
      date: opts.date,
      memo: `Sale ${opts.reference}${suffix(opts.party)}`,
      lines,
    })
  }
  if (opts.cogsCost > 0) {
    addJournalEntry({
      date: opts.date,
      memo: `Cost of goods sold ${opts.reference}`,
      lines: [dr(ACC.cogs, opts.cogsCost), cr(ACC.inv, opts.cogsCost)],
    })
  }
}
