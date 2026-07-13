import { getStockItemRef, removeStock } from './mockInventory'
import { recordMovement } from './mockMovements'
import { fifoCostToIssue } from './mockStockMovements'
import type { StockItemKind } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The single validated path for taking stock OUT of inventory. Sales and issued
 * invoices both route through here, so the invariant "on-hand only decreases via
 * a sale" holds no matter which document triggered it. Availability is checked
 * for the combined per-item demand up front, so an issue is all-or-nothing — it
 * never partially deducts and then throws.
 *
 * Returns the total FIFO cost of the goods issued (COGS) so the caller can post
 * the matching accounting entry.
 */

export interface IssueLine {
  itemKind: StockItemKind
  itemId: string
  quantity: number
}

export function issueStockOut(
  lines: IssueLine[],
  date: string,
  reference: string,
): number {
  // Sum demand per item, then validate every item can cover it.
  const demand = new Map<string, number>()
  for (const l of lines) {
    const key = `${l.itemKind}:${l.itemId}`
    demand.set(key, (demand.get(key) ?? 0) + l.quantity)
  }
  for (const [key, qty] of demand) {
    const [kind, id] = key.split(':') as [StockItemKind, string]
    const ref = getStockItemRef(kind, id)
    if (!ref) throw new Error('A selected item no longer exists.')
    if (ref.quantity < qty) {
      throw new Error(
        `Not enough ${ref.name}: have ${ref.quantity} ${ref.unit}, need ${qty}.`,
      )
    }
  }

  let cogs = 0
  for (const l of lines) {
    // Value the issue at FIFO cost BEFORE recording its movement.
    cogs += fifoCostToIssue(l.itemKind, l.itemId, l.quantity)
    removeStock(l.itemKind, l.itemId, l.quantity)
    recordMovement({
      itemKind: l.itemKind,
      itemId: l.itemId,
      date,
      source: 'Sale',
      reference,
      location: 'MAIN WAREHOUSE',
      direction: 'out',
      quantity: l.quantity,
      unitCost: 0,
    })
  }
  return round2(cogs)
}
