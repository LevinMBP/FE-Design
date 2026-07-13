import type { OpeningLot } from './types'

/** A cost-layer row as typed in a form (fields may be blank mid-edit). */
export interface OpeningLotInput {
  quantity?: number
  unitCost?: number
}

export interface ResolvedOpeningLots {
  lots: OpeningLot[]
  /** Total opening on-hand across all lots. */
  quantity: number
  /** Quantity-weighted average cost — the item's blended unit cost. */
  unitCost: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Keep only rows with a real quantity and a cost. */
export function validLots(rows: OpeningLotInput[] | undefined): OpeningLot[] {
  return (rows ?? [])
    .filter((l) => (l.quantity ?? 0) > 0 && l.unitCost != null && l.unitCost >= 0)
    .map((l) => ({ quantity: l.quantity as number, unitCost: l.unitCost as number }))
}

/**
 * Collapse cost layers into the totals an item needs: summed quantity and a
 * quantity-weighted average cost. Returns null if no usable rows.
 */
export function resolveOpeningLots(
  rows: OpeningLotInput[] | undefined,
): ResolvedOpeningLots | null {
  const lots = validLots(rows)
  if (lots.length === 0) return null
  const quantity = lots.reduce((s, l) => s + l.quantity, 0)
  const value = lots.reduce((s, l) => s + l.quantity * l.unitCost, 0)
  return { lots, quantity, unitCost: round2(value / quantity) }
}
