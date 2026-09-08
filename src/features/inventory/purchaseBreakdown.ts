import dayjs from 'dayjs'
import { listMaterials, listProducts } from './mockInventory'
import { listPurchases, purchasesVersion } from './mockPurchases'
import { purchaseAddsStock, purchaseOutstanding, purchasePaymentStatus } from './types'
import type { PaymentStatus, PurchaseLine, PurchaseType, StockItemKind } from './types'

/**
 * Purchase breakdown — what was bought, viewable per item, per order or per
 * vendor.
 *
 * All three views are pivots of one atom: an item's contribution to one
 * purchase order (`PurchaseCell`). Spend is the line's subtotal less its share
 * of the document discount — the figure actually debited to inventory, assets
 * or expense, so the report ties back to the books rather than to order totals.
 * Input tax is carried separately (it is recoverable, not spend) and the two
 * add back up to what the vendor is owed.
 *
 * Every purchase counts: unlike an invoice there is no draft state — an order
 * has already received its stock and posted its journal. Payment status is
 * reported, never filtered on: the spend happened when the order was raised.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/** Inclusive ISO date bounds; omit either side for "open-ended". */
export interface PurchaseBreakdownFilter {
  from?: string
  to?: string
}

/** Money figures every row and the report footer share. */
interface Money {
  quantity: number
  net: number // spend after the document discount, before tax
  tax: number // input tax riding on that spend
  total: number // net + tax — what the vendor is owed for it
}

/**
 * Settlement is a property of the *order*, so it is only ever summed over
 * distinct orders — never split across the items on one.
 */
interface Settlement {
  paid: number
  outstanding: number
}

export interface PurchaseBreakdownTotals extends Money, Settlement {
  itemCount: number
  orderCount: number
  vendorCount: number
}

/* ------------------------------ Per item ------------------------------ */

/** One order's contribution to an item's (or a vendor's) totals. */
export interface OrderPurchaseEntry extends Money {
  orderId: string
  reference: string
  date: string
  vendorName: string
  status: PaymentStatus
}

export interface ItemPurchaseRow extends Money {
  key: string
  type: PurchaseType
  itemKind?: StockItemKind
  itemId?: string
  itemName: string
  sku: string
  unit: string
  orderCount: number
  vendorCount: number
  entries: OrderPurchaseEntry[]
}

export interface PurchasesByItemReport {
  rows: ItemPurchaseRow[]
  totals: PurchaseBreakdownTotals
}

/* ------------------------------ Per order ------------------------------ */

/** One item's contribution to an order's totals. */
export interface PurchaseItemEntry extends Money {
  key: string
  type: PurchaseType
  itemName: string
  sku: string
  unit: string
}

export interface OrderPurchaseRow extends Money, Settlement {
  key: string
  orderId: string
  reference: string
  date: string
  dueDate: string
  vendorName: string
  status: PaymentStatus
  itemCount: number
  /** Document-level figures, so a row reconciles with the order itself. */
  discountAmount: number
  orderTotal: number
  entries: PurchaseItemEntry[]
}

export interface PurchasesByOrderReport {
  rows: OrderPurchaseRow[]
  totals: PurchaseBreakdownTotals
}

/* ------------------------------ Per vendor ----------------------------- */

export interface VendorPurchaseRow extends Money, Settlement {
  key: string
  vendorId: string
  vendorName: string
  orderCount: number
  itemCount: number
  /** Newest order date, so a row shows how recently the vendor was used. */
  lastOrder: string
  entries: OrderPurchaseEntry[]
}

export interface PurchasesByVendorReport {
  rows: VendorPurchaseRow[]
  totals: PurchaseBreakdownTotals
}

/* ------------------------------- Sourcing ------------------------------- */

/** One item's share of one order — the atom all three groupings pivot. */
interface PurchaseCell extends Money {
  orderId: string
  reference: string
  date: string
  dueDate: string
  vendorId: string
  vendorName: string
  status: PaymentStatus
  discountAmount: number
  orderTotal: number
  orderPaid: number
  orderOutstanding: number
  itemKey: string
  type: PurchaseType
  itemKind?: StockItemKind
  itemId?: string
  itemName: string
  sku: string
  unit: string
}

interface ItemFacts {
  name: string
  sku: string
  unit: string
}

/**
 * Names, SKUs and units for every stock item, straight off the master lists —
 * the same shortcut the sales breakdown takes, and for the same reason: the
 * stock ledger would replay FIFO just to hand back a name.
 */
function itemFacts(): Map<string, ItemFacts> {
  const facts = new Map<string, ItemFacts>()
  for (const p of listProducts()) {
    facts.set(`product:${p.id}`, { name: p.name, sku: p.sku, unit: 'ea' })
  }
  for (const m of listMaterials()) {
    facts.set(`material:${m.id}`, { name: m.name, sku: m.sku, unit: m.unit })
  }
  return facts
}

/**
 * What an order line groups under. Stock lines group by the item they received;
 * asset/service/expense lines have no item to point at, so they group by type
 * and description — two "Inbound freight" charges are one line of the report.
 */
function cellKeyOf(line: PurchaseLine): string {
  return purchaseAddsStock(line.type)
    ? `${line.itemKind}:${line.itemId}`
    : `${line.type}:${line.itemName.trim().toLowerCase()}`
}

/** Every (order × item) cell in the period. */
function collectCells(filter: PurchaseBreakdownFilter): PurchaseCell[] {
  const orders = listPurchases().filter(
    (p) =>
      (!filter.from || p.date >= filter.from) &&
      (!filter.to || p.date <= filter.to),
  )

  const facts = itemFacts()
  const cells: PurchaseCell[] = []

  for (const order of orders) {
    // The document discount scales every line down by the same proportion —
    // exactly how the order scaled its own taxes and journal debits.
    const keptFraction = order.subtotal > 0 ? order.gross / order.subtotal : 1
    const outstanding = purchaseOutstanding(order)

    // Fold the order's lines down to one cell per item first, so an item
    // received on two lines is one row. The first line for an item carries the
    // fallback name/unit snapshot.
    const perItem = new Map<
      string,
      { line: PurchaseLine; quantity: number; net: number; tax: number }
    >()
    for (const line of order.lines) {
      const itemKey = cellKeyOf(line)
      const acc = perItem.get(itemKey) ?? { line, quantity: 0, net: 0, tax: 0 }
      acc.quantity += line.quantity
      acc.net += line.lineSubtotal * keptFraction
      acc.tax += line.taxAmount * keptFraction
      perItem.set(itemKey, acc)
    }

    const made: PurchaseCell[] = []
    for (const [itemKey, acc] of perItem) {
      const line = acc.line
      const stock = purchaseAddsStock(line.type)
      const known = stock ? facts.get(itemKey) : undefined
      const net = round2(acc.net)
      const tax = round2(acc.tax)
      made.push({
        orderId: order.id,
        reference: order.reference,
        date: order.date,
        dueDate: order.dueDate,
        vendorId: order.vendorId,
        vendorName: order.vendorName,
        status: purchasePaymentStatus(order),
        discountAmount: order.discountAmount,
        orderTotal: order.total,
        orderPaid: order.amountPaid,
        orderOutstanding: outstanding,
        itemKey,
        type: line.type,
        itemKind: line.itemKind,
        itemId: line.itemId,
        // Deleted items keep the name/unit snapshot the order captured.
        itemName: known?.name ?? line.itemName,
        sku: known?.sku ?? '—',
        unit: known?.unit ?? line.unit,
        quantity: round2(acc.quantity),
        net,
        tax,
        total: round2(net + tax),
      })
    }

    // Scaling each line separately can leave the cells a centavo off the order
    // they came from. Park the drift on the first cell — the same trick the
    // journal posting uses — so a row always reconciles with the document.
    if (made.length > 0) {
      const netDrift = round2(order.gross - made.reduce((s, c) => s + c.net, 0))
      const taxDrift = round2(order.taxAmount - made.reduce((s, c) => s + c.tax, 0))
      const first = made[0]
      first.net = round2(first.net + netDrift)
      first.tax = round2(first.tax + taxDrift)
      first.total = round2(first.net + first.tax)
    }
    cells.push(...made)
  }
  return cells
}

/**
 * The six views (item / order / vendor, flat / monthly) are pivots of the *same*
 * cells, and switching between them is the common interaction — so the last
 * aggregation is kept and reused. The key carries the data version, so a new
 * order or a vendor payment misses the cache rather than serving stale figures.
 */
let cellCache: { key: string; cells: PurchaseCell[] } | null = null

function cellsFor(filter: PurchaseBreakdownFilter): PurchaseCell[] {
  const key = [filter.from ?? '', filter.to ?? '', purchasesVersion()].join('|')
  if (cellCache?.key === key) return cellCache.cells
  const cells = collectCells(filter)
  cellCache = { key, cells }
  return cells
}

/** Settlement summed over the distinct orders a set of cells came from. */
function settlementOf(cells: PurchaseCell[]): Settlement {
  const seen = new Set<string>()
  let paid = 0
  let outstanding = 0
  for (const cell of cells) {
    if (seen.has(cell.orderId)) continue
    seen.add(cell.orderId)
    paid += cell.orderPaid
    outstanding += cell.orderOutstanding
  }
  return { paid: round2(paid), outstanding: round2(outstanding) }
}

/** Sum a set of cells into the report footer. */
function totalsOf(cells: PurchaseCell[]): PurchaseBreakdownTotals {
  const net = round2(cells.reduce((s, c) => s + c.net, 0))
  const tax = round2(cells.reduce((s, c) => s + c.tax, 0))
  return {
    quantity: round2(cells.reduce((s, c) => s + c.quantity, 0)),
    net,
    tax,
    total: round2(net + tax),
    ...settlementOf(cells),
    itemCount: new Set(cells.map((c) => c.itemKey)).size,
    orderCount: new Set(cells.map((c) => c.orderId)).size,
    vendorCount: new Set(cells.map((c) => c.vendorId)).size,
  }
}

/** Accumulate a cell's money onto a row. */
function addMoney(row: Money, cell: Money) {
  row.quantity = round2(row.quantity + cell.quantity)
  row.net = round2(row.net + cell.net)
  row.tax = round2(row.tax + cell.tax)
  row.total = round2(row.net + row.tax)
}

/** The cell's own money, as an entry's worth of it. */
function moneyOf(cell: PurchaseCell): Money {
  return {
    quantity: cell.quantity,
    net: cell.net,
    tax: cell.tax,
    total: cell.total,
  }
}

function orderEntryOf(cell: PurchaseCell): OrderPurchaseEntry {
  return {
    orderId: cell.orderId,
    reference: cell.reference,
    date: cell.date,
    vendorName: cell.vendorName,
    status: cell.status,
    ...moneyOf(cell),
  }
}

/* ------------------------------- Pivots ------------------------------- */

/** Grouped by item: what each item cost to buy, ranked by spend. */
function pivotByItem(cells: PurchaseCell[]): ItemPurchaseRow[] {
  const rows = new Map<string, ItemPurchaseRow>()
  const vendorsSeen = new Map<string, Set<string>>()

  for (const cell of cells) {
    let row = rows.get(cell.itemKey)
    if (!row) {
      row = {
        key: cell.itemKey,
        type: cell.type,
        itemKind: cell.itemKind,
        itemId: cell.itemId,
        itemName: cell.itemName,
        sku: cell.sku,
        unit: cell.unit,
        quantity: 0,
        net: 0,
        tax: 0,
        total: 0,
        orderCount: 0,
        vendorCount: 0,
        entries: [],
      }
      rows.set(cell.itemKey, row)
      vendorsSeen.set(cell.itemKey, new Set())
    }
    addMoney(row, cell)
    row.orderCount += 1
    const vendors = vendorsSeen.get(cell.itemKey)!
    vendors.add(cell.vendorId || cell.vendorName)
    row.vendorCount = vendors.size
    row.entries.push(orderEntryOf(cell))
  }

  const ranked = [...rows.values()].sort((a, b) => b.net - a.net)
  for (const row of ranked) row.entries.sort((a, b) => b.date.localeCompare(a.date))
  return ranked
}

/** Grouped by order: what each PO bought, newest first. */
function pivotByOrder(cells: PurchaseCell[]): OrderPurchaseRow[] {
  const rows = new Map<string, OrderPurchaseRow>()

  for (const cell of cells) {
    let row = rows.get(cell.orderId)
    if (!row) {
      row = {
        key: cell.orderId,
        orderId: cell.orderId,
        reference: cell.reference,
        date: cell.date,
        dueDate: cell.dueDate,
        vendorName: cell.vendorName,
        status: cell.status,
        quantity: 0,
        net: 0,
        tax: 0,
        total: 0,
        paid: cell.orderPaid,
        outstanding: cell.orderOutstanding,
        itemCount: 0,
        discountAmount: cell.discountAmount,
        orderTotal: cell.orderTotal,
        entries: [],
      }
      rows.set(cell.orderId, row)
    }
    addMoney(row, cell)
    row.itemCount += 1
    row.entries.push({
      key: cell.itemKey,
      type: cell.type,
      itemName: cell.itemName,
      sku: cell.sku,
      unit: cell.unit,
      ...moneyOf(cell),
    })
  }

  const ordered = [...rows.values()].sort((a, b) =>
    a.date === b.date
      ? b.reference.localeCompare(a.reference)
      : b.date.localeCompare(a.date),
  )
  for (const row of ordered) row.entries.sort((a, b) => b.net - a.net)
  return ordered
}

/** Grouped by vendor: what each supplier was bought from, ranked by spend. */
function pivotByVendor(cells: PurchaseCell[]): VendorPurchaseRow[] {
  const rows = new Map<string, VendorPurchaseRow>()
  const itemsSeen = new Map<string, Set<string>>()
  // Orders fold to one entry each, so a vendor's expansion lists its POs.
  const entriesByOrder = new Map<string, Map<string, OrderPurchaseEntry>>()

  for (const cell of cells) {
    const key = cell.vendorId || cell.vendorName || 'unassigned'
    let row = rows.get(key)
    if (!row) {
      row = {
        key,
        vendorId: cell.vendorId,
        vendorName: cell.vendorName,
        quantity: 0,
        net: 0,
        tax: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
        orderCount: 0,
        itemCount: 0,
        lastOrder: cell.date,
        entries: [],
      }
      rows.set(key, row)
      itemsSeen.set(key, new Set())
      entriesByOrder.set(key, new Map())
    }
    addMoney(row, cell)
    if (cell.date > row.lastOrder) row.lastOrder = cell.date

    const items = itemsSeen.get(key)!
    items.add(cell.itemKey)
    row.itemCount = items.size

    // Settlement is per order — count it once, on the order's first cell.
    const orders = entriesByOrder.get(key)!
    const entry = orders.get(cell.orderId)
    if (entry) {
      entry.quantity = round2(entry.quantity + cell.quantity)
      entry.net = round2(entry.net + cell.net)
      entry.tax = round2(entry.tax + cell.tax)
      entry.total = round2(entry.net + entry.tax)
    } else {
      orders.set(cell.orderId, orderEntryOf(cell))
      row.orderCount = orders.size
      row.paid = round2(row.paid + cell.orderPaid)
      row.outstanding = round2(row.outstanding + cell.orderOutstanding)
    }
  }

  const ranked = [...rows.values()].sort((a, b) => b.net - a.net)
  for (const row of ranked) {
    row.entries = [...entriesByOrder.get(row.key)!.values()].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
  }
  return ranked
}

/* ------------------------------- Reports ------------------------------- */

export function buildPurchasesByItem(
  filter: PurchaseBreakdownFilter = {},
): PurchasesByItemReport {
  const cells = cellsFor(filter)
  return { rows: pivotByItem(cells), totals: totalsOf(cells) }
}

export function buildPurchasesByOrder(
  filter: PurchaseBreakdownFilter = {},
): PurchasesByOrderReport {
  const cells = cellsFor(filter)
  return { rows: pivotByOrder(cells), totals: totalsOf(cells) }
}

export function buildPurchasesByVendor(
  filter: PurchaseBreakdownFilter = {},
): PurchasesByVendorReport {
  const cells = cellsFor(filter)
  return { rows: pivotByVendor(cells), totals: totalsOf(cells) }
}

/* ------------------------------- Monthly ------------------------------- */

/**
 * One month of the report: its rows, that month's totals, and the totals for
 * everything up to and including it. The cumulative counts stay *distinct* — an
 * item bought in both January and February counts once.
 */
export interface MonthlySection<TRow> {
  key: string // YYYY-MM
  label: string // e.g. 'February 2026'
  rows: TRow[]
  totals: PurchaseBreakdownTotals
  cumulative: PurchaseBreakdownTotals
}

export interface PurchasesByMonthReport<TRow> {
  sections: MonthlySection<TRow>[]
  totals: PurchaseBreakdownTotals
}

/**
 * Split the period into months, oldest first, and run the given pivot inside
 * each. Months with no purchases are skipped — an empty section says nothing,
 * and the cumulative column carries across the gap unchanged.
 */
function buildMonthly<TRow>(
  filter: PurchaseBreakdownFilter,
  pivot: (cells: PurchaseCell[]) => TRow[],
): PurchasesByMonthReport<TRow> {
  const cells = cellsFor(filter)
  const byMonth = new Map<string, PurchaseCell[]>()
  for (const cell of cells) {
    const key = cell.date.slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(cell)
    else byMonth.set(key, [cell])
  }

  // Carry the running figures forward month by month instead of re-summing
  // everything so far for each one: the Sets keep the counts distinct while
  // staying linear overall.
  let quantity = 0
  let net = 0
  let tax = 0
  let paid = 0
  let outstanding = 0
  const seenItems = new Set<string>()
  const seenOrders = new Set<string>()
  const seenVendors = new Set<string>()

  const sections = [...byMonth.keys()].sort().map((key) => {
    const monthCells = byMonth.get(key)!
    for (const cell of monthCells) {
      quantity += cell.quantity
      net += cell.net
      tax += cell.tax
      seenItems.add(cell.itemKey)
      seenVendors.add(cell.vendorId)
      if (!seenOrders.has(cell.orderId)) {
        seenOrders.add(cell.orderId)
        paid += cell.orderPaid
        outstanding += cell.orderOutstanding
      }
    }
    return {
      key,
      label: dayjs(`${key}-01`).format('MMMM YYYY'),
      rows: pivot(monthCells),
      totals: totalsOf(monthCells),
      cumulative: {
        quantity: round2(quantity),
        net: round2(net),
        tax: round2(tax),
        total: round2(round2(net) + round2(tax)),
        paid: round2(paid),
        outstanding: round2(outstanding),
        itemCount: seenItems.size,
        orderCount: seenOrders.size,
        vendorCount: seenVendors.size,
      },
    }
  })

  return { sections, totals: totalsOf(cells) }
}

/** Month-by-month, each month's items with its totals and running totals. */
export function buildMonthlyPurchasesByItem(
  filter: PurchaseBreakdownFilter = {},
): PurchasesByMonthReport<ItemPurchaseRow> {
  return buildMonthly(filter, pivotByItem)
}

/** Month-by-month, each month's orders with its totals and running totals. */
export function buildMonthlyPurchasesByOrder(
  filter: PurchaseBreakdownFilter = {},
): PurchasesByMonthReport<OrderPurchaseRow> {
  return buildMonthly(filter, pivotByOrder)
}

/** Month-by-month, each month's vendors with its totals and running totals. */
export function buildMonthlyPurchasesByVendor(
  filter: PurchaseBreakdownFilter = {},
): PurchasesByMonthReport<VendorPurchaseRow> {
  return buildMonthly(filter, pivotByVendor)
}
