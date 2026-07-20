import { listMaterials, listProducts } from './mockInventory'
import { listMovementsForItem, type RawMovement } from './mockMovements'
import { resolveLocationId } from './mockLocations'
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
  balance: number // on-hand implied by the replayed movements
}

/** Replay stored movements through a FIFO queue, producing display rows + layers. */
function runFifo(itemId: string, itemKind: StockItemKind, moves: RawMovement[]): FifoResult {
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

  return { rows, layers, stockValue, avgCost, balance }
}

/**
 * Movements for one item, optionally narrowed to a single location.
 *
 * Unscoped (`locationId` omitted) the whole item history is replayed, which is
 * what every costing screen wants. Scoped, only the rows physically at that
 * location are replayed — so `balance` becomes that location's on-hand and the
 * FIFO layers are that location's own lot queue.
 */
function movesFor(kind: StockItemKind, id: string, locationId?: string): RawMovement[] {
  const all = listMovementsForItem(kind, id)
  if (!locationId) return all
  return all.filter((m) => resolveLocationId(m.location) === locationId)
}

/** Date of the most recent inbound Purchase, i.e. when this item was last ordered in. */
function lastOrderDate(moves: RawMovement[]): string | null {
  const orders = moves.filter((m) => m.source === 'Purchase' && m.direction === 'in')
  return orders.length > 0 ? orders[orders.length - 1].date : null
}

/** Date of the most recent movement of any kind — when stock last actually changed. */
function lastUpdatedDate(moves: RawMovement[]): string | null {
  return moves.length > 0 ? moves[moves.length - 1].date : null
}

function materialToItem(m: Material, locationId?: string): StockItem {
  const moves = movesFor('material', m.id, locationId)
  const { stockValue, avgCost, balance } = runFifo(m.id, 'material', moves)
  // Unscoped, the master quantity stays authoritative (it is what every other
  // screen reads); scoped, on-hand can only come from that location's movements.
  const onHand = locationId ? balance : m.quantity
  return {
    id: m.id,
    kind: 'material',
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    onHand,
    status: statusFor(onHand, m.minStock),
    avgCost,
    stockValue,
    lastOrder: lastOrderDate(moves),
    lastUpdated: lastUpdatedDate(moves),
  }
}

function productToItem(p: Product, locationId?: string): StockItem {
  const moves = movesFor('product', p.id, locationId)
  const { stockValue, avgCost, balance } = runFifo(p.id, 'product', moves)
  const onHand = locationId ? balance : p.quantity
  return {
    id: p.id,
    kind: 'product',
    name: p.name,
    sku: p.sku,
    unit: 'ea',
    onHand,
    status: statusFor(onHand, 10),
    avgCost,
    stockValue,
    lastOrder: lastOrderDate(moves),
    lastUpdated: lastUpdatedDate(moves),
  }
}

/**
 * Combined product + material list for the stock overview. Pass a location id to
 * report each item as it stands *at that location*; omit it for the whole company.
 */
export function listStockItems(locationId?: string): StockItem[] {
  return [
    ...listProducts().map((p) => productToItem(p, locationId)),
    ...listMaterials().map((m) => materialToItem(m, locationId)),
  ]
}

/**
 * FIFO cost of issuing `qty` of an item right now — the cost of the oldest
 * remaining layers it would consume, without mutating anything. Used to value
 * COGS at the moment of a sale. Call before recording the issue's movement so
 * the layers reflect pre-issue state.
 */
export function fifoCostToIssue(kind: StockItemKind, id: string, qty: number): number {
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
export function getItemLedger(kind: StockItemKind, id: string): ItemLedger | null {
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
