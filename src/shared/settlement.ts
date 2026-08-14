/**
 * Settlement primitives shared by the two sides of the ledger:
 *
 *   vendor   → payment    → allocated across purchase orders   (pays down AP)
 *   customer → collection → allocated across invoices / orders (clears AR)
 *
 * Both documents work the same way: one payment/receipt against one party,
 * split ("allocated") across that party's open documents. Nothing here knows
 * about purchases or invoices — it only deals in totals and amounts paid, so
 * the same status/rounding/auto-allocate rules apply on both sides.
 */

export type SettlementStatus = 'unpaid' | 'partial' | 'paid'

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Amounts within half a centavo are treated as equal (float tolerance). */
export const EPSILON = 0.005

/** What's still owed on a document. Never negative. */
export function outstandingOf(total: number, amountPaid: number): number {
  return Math.max(round2(total - amountPaid), 0)
}

/** Where a document stands on settlement, from its total vs what's been paid. */
export function settlementStatus(
  total: number,
  amountPaid: number,
): SettlementStatus {
  if (amountPaid <= EPSILON) return 'unpaid'
  if (amountPaid + EPSILON >= total) return 'paid'
  return 'partial'
}

/** A document still carrying a balance is "open" — allocatable. */
export function isOpen(total: number, amountPaid: number): boolean {
  return outstandingOf(total, amountPaid) > EPSILON
}

export const SETTLEMENT_TAG: Record<
  SettlementStatus,
  { label: string; color: string }
> = {
  unpaid: { label: 'Unpaid', color: 'error' },
  partial: { label: 'Partial', color: 'warning' },
  paid: { label: 'Paid', color: 'success' },
}

/** The minimum a document needs to appear in an allocation table. */
export interface AllocatableDoc {
  /** Unique within the table (an id, or `kind:id` when kinds are mixed). */
  key: string
  reference: string
  date: string
  dueDate?: string
  /** Optional pill shown beside the reference, e.g. "Invoice" / "Order". */
  badge?: { label: string; color: string }
  total: number
  amountPaid: number
  outstanding: number
  /**
   * The document's tax-exclusive value — withholding is computed on income, not
   * on the VAT riding on top of it. Defaults to `total` when the document
   * carries no tax.
   */
  netBase?: number
}

/**
 * Withholding due on a part payment of a document.
 *
 * Withholding is levied on the income portion only, so an allocation is first
 * scaled down to the document's tax-exclusive share (`netBase / total`) and the
 * rate applied to that. Paying a VAT-inclusive bill in halves therefore
 * withholds half the tax each time, and the two halves add up to withholding on
 * the whole net amount.
 */
export function withholdingFor(
  doc: Pick<AllocatableDoc, 'total' | 'netBase'>,
  applied: number,
  ratePercent: number,
): number {
  if (!ratePercent || applied <= 0) return 0
  const netShare = doc.total > 0 ? (doc.netBase ?? doc.total) / doc.total : 1
  return round2(applied * netShare * (ratePercent / 100))
}

/**
 * Spread `amount` across `docs` oldest-first, filling each document's
 * outstanding balance before moving on. Whatever can't be placed is returned as
 * `unallocated`, so the caller can tell the user their payment exceeds what the
 * party is owed.
 */
export function allocateOldestFirst(
  docs: AllocatableDoc[],
  amount: number,
): { amounts: Record<string, number>; unallocated: number } {
  let left = round2(amount)
  const amounts: Record<string, number> = {}
  for (const doc of [...docs].sort((a, b) => a.date.localeCompare(b.date))) {
    if (left <= EPSILON) break
    const take = round2(Math.min(left, doc.outstanding))
    if (take <= 0) continue
    amounts[doc.key] = take
    left = round2(left - take)
  }
  return { amounts, unallocated: Math.max(left, 0) }
}

/** Total currently allocated across an amounts map. */
export function allocatedTotal(amounts: Record<string, number>): number {
  return round2(
    Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0),
  )
}
