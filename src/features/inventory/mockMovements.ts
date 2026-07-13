import { listMaterials, listProducts } from './mockInventory'
import type { MovementDirection, OpeningLot, StockItemKind } from './types'

/**
 * The real, stored stock-movement table — the single source of truth for stock
 * history. Every change to on-hand is recorded here as a row:
 *   - Opening Balance: an item's starting count (seeded from its create-time qty)
 *   - Purchase:       stock IN  (the only way to add product/material inventory)
 *   - Sale:           stock OUT (the only way to reduce it externally)
 *   - Manufacturing:  internal transfer (materials OUT, finished product IN)
 *
 * On-hand (the item's `quantity`) always equals opening + Σ movements because
 * every mutation path appends here. The FIFO ledger in `mockStockMovements.ts`
 * reads these rows for display. In-memory; resets on full reload.
 */

const uid = () => `mov_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100

export interface RawMovement {
  id: string
  itemKind: StockItemKind
  itemId: string
  seq: number // insertion order — stable tiebreaker when dates match
  date: string // ISO date (YYYY-MM-DD)
  source: 'Opening Balance' | 'Purchase' | 'Sale' | 'Manufacturing' | 'Adjustment'
  reference: string
  location: string
  direction: MovementDirection
  quantity: number
  unitCost: number // 'in' → lot cost; 'out' → 0 (FIFO fills at display time)
}

let movements: RawMovement[] = []
let seq = 0

/** Items that already have an opening-balance row, so we never seed twice. */
const openingDone = new Set<string>()
const keyOf = (kind: StockItemKind, id: string) => `${kind}:${id}`

interface AppendInput {
  itemKind: StockItemKind
  itemId: string
  date: string
  source: RawMovement['source']
  reference: string
  location: string
  direction: MovementDirection
  quantity: number
  unitCost: number
}

function append(input: AppendInput): RawMovement {
  const row: RawMovement = { id: uid(), seq: seq++, ...input }
  movements.push(row)
  return row
}

/**
 * Seed one Opening Balance movement per opening lot, oldest first, so FIFO
 * issues them in order. Zero/blank lots are skipped.
 */
function appendOpeningLot(kind: StockItemKind, id: string, lot: OpeningLot) {
  if (lot.quantity <= 0) return
  append({
    itemKind: kind,
    itemId: id,
    date: '2026-01-01',
    source: 'Opening Balance',
    reference: 'Opening Balance',
    location: '—',
    direction: 'in',
    quantity: lot.quantity,
    unitCost: round2(lot.unitCost),
  })
}

/**
 * Opening cost basis: materials use their unit cost, products ~65% of price.
 * When the item carries explicit `openingLots`, each becomes its own FIFO
 * layer instead of one blended lot.
 */
function ensureOpening(
  kind: StockItemKind,
  id: string,
  quantity: number,
  unitCost: number,
  lots?: OpeningLot[],
) {
  const key = keyOf(kind, id)
  if (openingDone.has(key)) return
  openingDone.add(key)
  if (lots && lots.length > 0) {
    for (const lot of lots) appendOpeningLot(kind, id, lot)
    return
  }
  if (quantity <= 0) return // nothing on hand → no opening lot needed
  appendOpeningLot(kind, id, { quantity, unitCost })
}

/**
 * Make sure every current item has captured its opening balance. Idempotent and
 * cheap; called before any read or append so openings always precede deltas —
 * regardless of the order screens are visited or documents are posted.
 */
export function ensureOpeningBalances() {
  for (const p of listProducts()) {
    ensureOpening('product', p.id, p.quantity, round2(p.price * 0.65), p.openingLots)
  }
  for (const m of listMaterials()) {
    ensureOpening('material', m.id, m.quantity, m.unitCost, m.openingLots)
  }
}

/** Record a stock-affecting movement (purchase, sale, or manufacturing). */
export function recordMovement(input: AppendInput): RawMovement {
  ensureOpeningBalances()
  return append(input)
}

/** True if this item already carries an opening balance. */
export function hasOpening(kind: StockItemKind, id: string): boolean {
  ensureOpeningBalances()
  return movements.some(
    (m) => m.itemKind === kind && m.itemId === id && m.source === 'Opening Balance',
  )
}

/**
 * Post opening stock as one Opening Balance movement per FIFO lot (oldest-first),
 * from an Opening Balance document. Unlike the create-time seed, the lots are
 * given explicitly with the document's date/location. We also mark the item's
 * opening as done so the idempotent `ensureOpeningBalances` never re-seeds a
 * second opening from the item's (now bumped) quantity. Throws if the item
 * already has an opening.
 */
export function postOpeningLots(
  kind: StockItemKind,
  id: string,
  lots: OpeningLot[],
  date: string,
  location: string,
): void {
  if (hasOpening(kind, id)) {
    throw new Error('This item already has an opening balance.')
  }
  const usable = lots.filter((l) => l.quantity > 0 && l.unitCost >= 0)
  if (usable.length === 0) {
    throw new Error('Add at least one batch with a quantity and unit cost.')
  }
  for (const lot of usable) {
    append({
      itemKind: kind,
      itemId: id,
      date,
      source: 'Opening Balance',
      reference: 'Opening Balance',
      location,
      direction: 'in',
      quantity: lot.quantity,
      unitCost: round2(lot.unitCost),
    })
  }
  openingDone.add(keyOf(kind, id))
}

/** All stored movements for one item, oldest first (opening anchors the list). */
export function listMovementsForItem(
  kind: StockItemKind,
  id: string,
): RawMovement[] {
  ensureOpeningBalances()
  return movements
    .filter((m) => m.itemKind === kind && m.itemId === id)
    .sort((a, b) => (a.date === b.date ? a.seq - b.seq : a.date.localeCompare(b.date)))
}
