import { listMaterials, listProducts } from './mockInventory'
import { listMovementsForItem, type RawMovement } from './mockMovements'
import type {
  FifoLayer,
  ItemLedger,
  LedgerRow,
  Material,
  Product,
  StockItem,
  StockItemKind,
  StockStatus,
} from './types'

/**
 * FIFO stock ledger, computed from the real stored movement table
 * (`mockMovements.ts`) — no synthesised history. Each *receipt (in)* carries
 * its own lot cost; each *issue (out)* draws down the oldest lots first (FIFO)
 * and is valued at the lots it consumed. On-hand value is the sum of the
 * remaining lots. The opening-balance movement anchors each item's ledger.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

function statusFor(onHand: number, lowAt: number): StockStatus {
  if (onHand <= 0) return 'out'
  if (onHand < lowAt) return 'low'
  return 'ok'
}

interface Lot {
  date: string
  reference: string
  qty: number // remaining
  originalQty: number // as received
  unitCost: number
}

interface FifoResult {
  rows: LedgerRow[]
  layers: FifoLayer[]
  stockValue: number
  avgCost: number
}

/** Replay stored movements through a FIFO queue, producing display rows + layers. */
function runFifo(
  itemId: string,
  itemKind: StockItemKind,
  moves: RawMovement[],
): FifoResult {
  const lots: Lot[] = []
  const valueOf = () => lots.reduce((s, l) => s + l.qty * l.unitCost, 0)

  const rows: LedgerRow[] = []
  let balance = 0
  let txn = 0

  moves.forEach((m) => {
    const isOpening = m.source === 'Opening Balance'
    let unitCost: number
    let value: number

    if (m.direction === 'in') {
      lots.push({
        date: m.date,
        reference: m.reference,
        qty: m.quantity,
        originalQty: m.quantity,
        unitCost: m.unitCost,
      })
      unitCost = m.unitCost
      value = round2(m.quantity * m.unitCost)
      balance += m.quantity
    } else {
      // Consume oldest lots first.
      let remaining = m.quantity
      let cost = 0
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0]
        const take = Math.min(remaining, lot.qty)
        cost += take * lot.unitCost
        lot.qty -= take
        remaining -= take
        if (lot.qty === 0) lots.shift()
      }
      value = round2(cost)
      unitCost = m.quantity > 0 ? round2(cost / m.quantity) : 0
      balance -= m.quantity
    }

    rows.push({
      id: m.id,
      itemId,
      itemKind,
      date: m.date,
      source: m.source,
      reference: m.reference,
      location: m.location,
      direction: m.direction,
      quantity: m.quantity,
      unitCost,
      txnNo: isOpening ? 0 : ++txn,
      balance,
      value,
      stockValue: round2(valueOf()),
      lots: lots.map((l) => ({
        reference: l.reference,
        date: l.date,
        originalQty: l.originalQty,
        left: l.qty,
        unitCost: l.unitCost,
      })),
      opening: isOpening || undefined,
    })
  })

  // Always anchor the ledger with an opening row, even for a zero-stock item.
  if (!moves.some((m) => m.source === 'Opening Balance')) {
    rows.unshift({
      id: `${itemId}-open`,
      itemId,
      itemKind,
      date: '2026-01-01',
      source: 'Opening Balance',
      reference: 'Opening Balance',
      location: '—',
      direction: 'in',
      quantity: 0,
      unitCost: 0,
      txnNo: 0,
      balance: 0,
      value: 0,
      stockValue: 0,
      lots: [],
      opening: true,
    })
  }

  const layers: FifoLayer[] = lots.map((l) => ({
    date: l.date,
    reference: l.reference,
    quantity: l.qty,
    unitCost: l.unitCost,
    value: round2(l.qty * l.unitCost),
  }))
  const stockValue = round2(valueOf())
  const avgCost = balance > 0 ? round2(stockValue / balance) : 0

  return { rows, layers, stockValue, avgCost }
}

function materialToItem(m: Material): StockItem {
  const { stockValue, avgCost } = runFifo(
    m.id,
    'material',
    listMovementsForItem('material', m.id),
  )
  return {
    id: m.id,
    kind: 'material',
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    onHand: m.quantity,
    status: statusFor(m.quantity, m.minStock),
    avgCost,
    stockValue,
  }
}

function productToItem(p: Product): StockItem {
  const { stockValue, avgCost } = runFifo(
    p.id,
    'product',
    listMovementsForItem('product', p.id),
  )
  return {
    id: p.id,
    kind: 'product',
    name: p.name,
    sku: p.sku,
    unit: 'ea',
    onHand: p.quantity,
    status: statusFor(p.quantity, 10),
    avgCost,
    stockValue,
  }
}

/** Combined product + material list for the stock overview. */
export function listStockItems(): StockItem[] {
  return [
    ...listProducts().map(productToItem),
    ...listMaterials().map(materialToItem),
  ]
}

/**
 * FIFO cost of issuing `qty` of an item right now — the cost of the oldest
 * remaining layers it would consume, without mutating anything. Used to value
 * COGS at the moment of a sale. Call before recording the issue's movement so
 * the layers reflect pre-issue state.
 */
export function fifoCostToIssue(
  kind: StockItemKind,
  id: string,
  qty: number,
): number {
  const { layers } = runFifo(id, kind, listMovementsForItem(kind, id))
  let remaining = qty
  let cost = 0
  for (const layer of layers) {
    if (remaining <= 0) break
    const take = Math.min(remaining, layer.quantity)
    cost += take * layer.unitCost
    remaining -= take
  }
  return round2(cost)
}

/**
 * Current FIFO-weighted average cost of an item's on-hand stock, or 0 when
 * nothing is on hand. Used to value a stock adjustment that ADDS units (the new
 * lot enters at the same cost as what's already there); decreases are valued by
 * `fifoCostToIssue` instead.
 */
export function currentAvgCost(kind: StockItemKind, id: string): number {
  const { avgCost } = runFifo(id, kind, listMovementsForItem(kind, id))
  return avgCost
}

/** Full ledger (rows + FIFO layers) for one item, or null if it doesn't exist. */
export function getItemLedger(
  kind: StockItemKind,
  id: string,
): ItemLedger | null {
  if (kind === 'material') {
    const m = listMaterials().find((x) => x.id === id)
    if (!m) return null
    const item = materialToItem(m)
    const { rows, layers, stockValue, avgCost } = runFifo(
      m.id,
      'material',
      listMovementsForItem('material', m.id),
    )
    return { item, rows, layers, stockValue, avgCost }
  }
  const p = listProducts().find((x) => x.id === id)
  if (!p) return null
  const item = productToItem(p)
  const { rows, layers, stockValue, avgCost } = runFifo(
    p.id,
    'product',
    listMovementsForItem('product', p.id),
  )
  return { item, rows, layers, stockValue, avgCost }
}
