import { addStock, getStockItemRef } from './mockInventory'
import { hasOpening, postOpeningLots } from './mockMovements'
import { postOpeningBalanceEntry } from '../accounting/autoPost'
import type { NewOpeningBalance, OpeningBalanceResult, OpeningLot } from './types'

/**
 * Opening Balance document — the only place a client's existing stock enters at
 * go-live. Each line loads one item's FIFO cost layers (qty + unit cost,
 * oldest-first). For every line we append the opening movements, bump on-hand to
 * match, and post ONE journal for the whole document:
 *   Dr Inventory / Cr Opening Balance Equity
 * so the stock value reconciles with the books. Validates all lines up front —
 * all-or-nothing, nothing is mutated if any line is invalid. In-memory.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

const cleanLots = (lots: OpeningLot[]): OpeningLot[] =>
  lots.filter((l) => l.quantity > 0 && l.unitCost >= 0)

const lotsValue = (lots: OpeningLot[]) =>
  lots.reduce((s, l) => s + l.quantity * l.unitCost, 0)

const lotsQty = (lots: OpeningLot[]) => lots.reduce((s, l) => s + l.quantity, 0)

export function recordOpeningBalance(
  input: NewOpeningBalance,
): OpeningBalanceResult {
  const lines = input.lines
    .map((l) => ({ ...l, lots: cleanLots(l.lots) }))
    .filter((l) => l.lots.length > 0)

  if (lines.length === 0) {
    throw new Error('Add at least one item with an opening batch.')
  }

  // Validate everything before mutating anything (all-or-nothing).
  const seen = new Set<string>()
  for (const l of lines) {
    const key = `${l.kind}:${l.itemId}`
    if (seen.has(key)) {
      throw new Error('Each item can only appear once per document.')
    }
    seen.add(key)

    const ref = getStockItemRef(l.kind, l.itemId)
    if (!ref) throw new Error('A selected item no longer exists.')
    if (hasOpening(l.kind, l.itemId)) {
      throw new Error(`${ref.name} already has an opening balance.`)
    }
  }

  let totalValue = 0
  for (const l of lines) {
    postOpeningLots(l.kind, l.itemId, l.lots, input.date, input.location)
    addStock(l.kind, l.itemId, lotsQty(l.lots))
    totalValue += lotsValue(l.lots)
  }
  totalValue = round2(totalValue)

  postOpeningBalanceEntry({ date: input.date, totalValue })

  return { itemsPosted: lines.length, totalValue }
}
