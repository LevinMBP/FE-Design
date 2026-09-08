import dayjs from 'dayjs'
import { listMaterials, listProducts } from './mockInventory'
import { listLocations, resolveLocationId } from './mockLocations'
import { movementsVersion } from './mockMovements'
import { listValuedMovements } from './mockStockMovements'
import type { ValuedMovement } from './mockStockMovements'
import type { MovementDirection, StockItemKind } from './types'
import type { RawMovement } from './mockMovements'

/**
 * Stock movement breakdown — what moved, viewable per item, per source or per
 * location.
 *
 * The report is a roll-forward: **opening + in − out = closing**, in units and
 * in money. Receipts are valued at their own lot cost and issues at the FIFO
 * lots they consumed — the same numbers the item ledger shows and the same ones
 * posted to the books, so closing value ties to the Inventory account.
 *
 * Every item that held stock at the start of the period or moved inside it gets
 * a row, including ones that sat still: a roll-forward that quietly drops them
 * no longer reconciles. The source and location views are pure *flow* pivots —
 * an opening balance belongs to an item, not to "Purchases" or to a warehouse.
 *
 * Per-location figures are movement flow only. FIFO itself is company-wide (see
 * the known gap in CLAUDE.md), so a location's *value* is what moved through it,
 * never a location-level cost pool.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export type MovementSource = RawMovement['source']

/** Inclusive ISO date bounds; omit either side for "open-ended". */
export interface StockBreakdownFilter {
  from?: string
  to?: string
}

/** What moved, in units and at cost. */
interface Flow {
  inQty: number
  inValue: number
  outQty: number
  outValue: number
  netQty: number
  netValue: number
}

/** Where an item stood either side of the period. */
interface Balance {
  openingQty: number
  openingValue: number
  closingQty: number
  closingValue: number
}

export interface StockBreakdownTotals extends Flow, Balance {
  movementCount: number
  itemCount: number
  sourceCount: number
  locationCount: number
}

/* ------------------------------ Per item ------------------------------ */

/** One movement under an item — the item's ledger, narrowed to the period. */
export interface MovementEntry {
  key: string
  date: string
  source: MovementSource
  reference: string
  location: string
  direction: MovementDirection
  quantity: number
  unitCost: number
  value: number
  /** On-hand and stock value the movement left the item at. */
  balance: number
  stockValue: number
}

export interface ItemStockRow extends Flow, Balance {
  key: string
  itemKind: StockItemKind
  itemId: string
  itemName: string
  sku: string
  unit: string
  movementCount: number
  /** in + out value — how much stock churned through the item. */
  throughput: number
  entries: MovementEntry[]
}

export interface StockByItemReport {
  rows: ItemStockRow[]
  totals: StockBreakdownTotals
}

/* --------------------- Per source and per location --------------------- */

/** One item's share of a source's or a location's flow. */
export interface ItemFlowEntry extends Flow {
  key: string
  itemKind: StockItemKind
  itemId: string
  itemName: string
  sku: string
  unit: string
  movementCount: number
}

export interface SourceStockRow extends Flow {
  key: string
  source: MovementSource
  movementCount: number
  itemCount: number
  throughput: number
  entries: ItemFlowEntry[]
}

export interface LocationStockRow extends Flow {
  key: string
  locationId: string
  location: string
  movementCount: number
  itemCount: number
  throughput: number
  entries: ItemFlowEntry[]
}

export interface StockBySourceReport {
  rows: SourceStockRow[]
  totals: StockBreakdownTotals
}

export interface StockByLocationReport {
  rows: LocationStockRow[]
  totals: StockBreakdownTotals
}

/* ------------------------------- Sourcing ------------------------------- */

/** One valued movement, with the item facts the report displays. */
interface StockCell extends ValuedMovement {
  itemKey: string
  itemName: string
  sku: string
  unit: string
}

/** Where an item stood at a point in time. */
interface ItemState {
  qty: number
  value: number
}

const ZERO: ItemState = { qty: 0, value: 0 }

interface PeriodData {
  cells: StockCell[]
  /** Per item, where it stood the moment before the period opened. */
  opening: Map<string, ItemState>
}

interface ItemFacts {
  name: string
  sku: string
  unit: string
}

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
 * Split the valued movement table at the period's edges: everything before it
 * collapses into each item's opening state, everything inside becomes a cell.
 * Movements after `to` are dropped — they have not happened yet as far as this
 * report is concerned.
 */
function collectPeriod(filter: StockBreakdownFilter): PeriodData {
  const facts = itemFacts()
  const cells: StockCell[] = []
  const opening = new Map<string, ItemState>()

  for (const move of listValuedMovements()) {
    if (filter.to && move.date > filter.to) continue
    const itemKey = `${move.itemKind}:${move.itemId}`
    if (filter.from && move.date < filter.from) {
      // Sorted oldest first, so the last one before the window wins.
      opening.set(itemKey, { qty: move.balance, value: move.stockValue })
      continue
    }
    const known = facts.get(itemKey)
    cells.push({
      ...move,
      itemKey,
      itemName: known?.name ?? '(removed item)',
      sku: known?.sku ?? '—',
      unit: known?.unit ?? '',
    })
  }
  return { cells, opening }
}

/**
 * The six views (item / source / location, flat / monthly) are pivots of the
 * *same* period data, and switching between them is the common interaction — so
 * the last split is kept and reused. The key carries the movement version, so
 * any new receipt or issue misses the cache rather than serving stale figures.
 */
let periodCache: { key: string; data: PeriodData } | null = null

function periodFor(filter: StockBreakdownFilter): PeriodData {
  const key = [filter.from ?? '', filter.to ?? '', movementsVersion()].join('|')
  if (periodCache?.key === key) return periodCache.data
  const data = collectPeriod(filter)
  periodCache = { key, data }
  return data
}

/**
 * Movements store a location *name*, and the writers disagree on how to spell it
 * — 'MAIN WAREHOUSE' from the hardcoded paths, 'Main Warehouse' from the picker,
 * '—' on seeded openings. Grouping on the raw string would split one warehouse
 * across several rows, so every movement is resolved to a location id first
 * (the same rule the location-scoped stock overview applies) and reported under
 * that location's proper name.
 */
function createLocationResolver() {
  const names = new Map(listLocations().map((l) => [l.id, l.name]))
  const resolved = new Map<string, string>()
  return {
    idOf(location: string): string {
      const cached = resolved.get(location)
      if (cached) return cached
      const id = resolveLocationId(location)
      resolved.set(location, id)
      return id
    },
    nameOf(id: string): string {
      return names.get(id) ?? id
    },
  }
}

/* ------------------------------ Arithmetic ------------------------------ */

const emptyFlow = (): Flow => ({
  inQty: 0,
  inValue: 0,
  outQty: 0,
  outValue: 0,
  netQty: 0,
  netValue: 0,
})

/** Fold one movement into a flow accumulator. */
function addFlow(flow: Flow, cell: StockCell) {
  if (cell.direction === 'in') {
    flow.inQty = round2(flow.inQty + cell.quantity)
    flow.inValue = round2(flow.inValue + cell.value)
  } else {
    flow.outQty = round2(flow.outQty + cell.quantity)
    flow.outValue = round2(flow.outValue + cell.value)
  }
  flow.netQty = round2(flow.inQty - flow.outQty)
  flow.netValue = round2(flow.inValue - flow.outValue)
}

/**
 * The period's footer. Opening and closing cover every item the report has a
 * row for — the items that moved plus the ones that merely held stock — so the
 * footer reads as the company's stock roll-forward and Σ rows ties to it.
 */
function totalsOf(cells: StockCell[], opening: Map<string, ItemState>): StockBreakdownTotals {
  const locations = createLocationResolver()
  const flow = emptyFlow()
  const closing = new Map<string, ItemState>()
  for (const cell of cells) {
    addFlow(flow, cell)
    closing.set(cell.itemKey, { qty: cell.balance, value: cell.stockValue })
  }

  const items = new Set([...opening.keys(), ...closing.keys()])
  let openingQty = 0
  let openingValue = 0
  let closingQty = 0
  let closingValue = 0
  let itemCount = 0
  for (const key of items) {
    const before = opening.get(key) ?? ZERO
    const after = closing.get(key) ?? before
    // An item that neither held stock nor moved has nothing to report.
    if (before.qty === 0 && before.value === 0 && after.qty === 0 && after.value === 0) {
      if (!closing.has(key)) continue
    }
    itemCount += 1
    openingQty += before.qty
    openingValue += before.value
    closingQty += after.qty
    closingValue += after.value
  }

  return {
    ...flow,
    openingQty: round2(openingQty),
    openingValue: round2(openingValue),
    closingQty: round2(closingQty),
    closingValue: round2(closingValue),
    movementCount: cells.length,
    itemCount,
    sourceCount: new Set(cells.map((c) => c.source)).size,
    locationCount: new Set(cells.map((c) => locations.idOf(c.location))).size,
  }
}

/** Where each item stands once the period's movements have played out. */
function closingStates(
  cells: StockCell[],
  opening: Map<string, ItemState>,
): Map<string, ItemState> {
  const closing = new Map(opening)
  for (const cell of cells) {
    closing.set(cell.itemKey, { qty: cell.balance, value: cell.stockValue })
  }
  return closing
}

/* ------------------------------- Pivots ------------------------------- */

/**
 * Grouped by item: each item's roll-forward, busiest first. Items that held
 * stock but did not move still get a row (opening = closing, no flow) so the
 * column adds up to the company's stock value.
 */
function pivotByItem(
  cells: StockCell[],
  opening: Map<string, ItemState>,
): ItemStockRow[] {
  const facts = itemFacts()
  const rows = new Map<string, ItemStockRow>()

  const rowFor = (
    itemKey: string,
    seed?: { itemKind: StockItemKind; itemId: string; itemName: string; sku: string; unit: string },
  ) => {
    let row = rows.get(itemKey)
    if (row) return row
    const [kind, id] = itemKey.split(':')
    const known = facts.get(itemKey)
    const before = opening.get(itemKey) ?? ZERO
    row = {
      key: itemKey,
      itemKind: seed?.itemKind ?? (kind as StockItemKind),
      itemId: seed?.itemId ?? id,
      itemName: seed?.itemName ?? known?.name ?? '(removed item)',
      sku: seed?.sku ?? known?.sku ?? '—',
      unit: seed?.unit ?? known?.unit ?? '',
      ...emptyFlow(),
      openingQty: before.qty,
      openingValue: before.value,
      closingQty: before.qty,
      closingValue: before.value,
      movementCount: 0,
      throughput: 0,
      entries: [],
    }
    rows.set(itemKey, row)
    return row
  }

  // Items carried in from before the period, so a still item still reconciles.
  for (const [itemKey, state] of opening) {
    if (state.qty === 0 && state.value === 0) continue
    rowFor(itemKey)
  }

  for (const cell of cells) {
    const row = rowFor(cell.itemKey, cell)
    addFlow(row, cell)
    row.movementCount += 1
    row.throughput = round2(row.inValue + row.outValue)
    // The last movement of the period *is* the closing position.
    row.closingQty = cell.balance
    row.closingValue = cell.stockValue
    row.entries.push({
      key: cell.id,
      date: cell.date,
      source: cell.source,
      reference: cell.reference,
      location: cell.location,
      direction: cell.direction,
      quantity: cell.quantity,
      unitCost: cell.unitCost,
      value: cell.value,
      balance: cell.balance,
      stockValue: cell.stockValue,
    })
  }

  return [...rows.values()].sort(
    (a, b) => b.throughput - a.throughput || b.closingValue - a.closingValue,
  )
}

/** Fold cells into flow rows keyed by whatever `keyOf` picks out. */
function pivotByFlow<TRow extends Flow & { key: string; movementCount: number; itemCount: number; throughput: number; entries: ItemFlowEntry[] }>(
  cells: StockCell[],
  keyOf: (cell: StockCell) => string,
  seed: (cell: StockCell, key: string) => TRow,
): TRow[] {
  const rows = new Map<string, TRow>()
  const entries = new Map<string, Map<string, ItemFlowEntry>>()

  for (const cell of cells) {
    const key = keyOf(cell)
    let row = rows.get(key)
    if (!row) {
      row = seed(cell, key)
      rows.set(key, row)
      entries.set(key, new Map())
    }
    addFlow(row, cell)
    row.movementCount += 1
    row.throughput = round2(row.inValue + row.outValue)

    const items = entries.get(key)!
    let entry = items.get(cell.itemKey)
    if (!entry) {
      entry = {
        key: cell.itemKey,
        itemKind: cell.itemKind,
        itemId: cell.itemId,
        itemName: cell.itemName,
        sku: cell.sku,
        unit: cell.unit,
        movementCount: 0,
        ...emptyFlow(),
      }
      items.set(cell.itemKey, entry)
    }
    addFlow(entry, cell)
    entry.movementCount += 1
    row.itemCount = items.size
  }

  const ranked = [...rows.values()].sort((a, b) => b.throughput - a.throughput)
  for (const row of ranked) {
    row.entries = [...entries.get(row.key)!.values()].sort(
      (a, b) => b.inValue + b.outValue - (a.inValue + a.outValue),
    )
  }
  return ranked
}

/** Grouped by what caused the movement: purchases, sales, manufacturing… */
function pivotBySource(cells: StockCell[]): SourceStockRow[] {
  return pivotByFlow<SourceStockRow>(
    cells,
    (cell) => cell.source,
    (cell, key) => ({
      key,
      source: cell.source,
      movementCount: 0,
      itemCount: 0,
      throughput: 0,
      entries: [],
      ...emptyFlow(),
    }),
  )
}

/** Grouped by the location each movement resolves to. */
function pivotByLocation(cells: StockCell[]): LocationStockRow[] {
  const locations = createLocationResolver()
  return pivotByFlow<LocationStockRow>(
    cells,
    (cell) => locations.idOf(cell.location),
    (_cell, key) => ({
      key,
      locationId: key,
      location: locations.nameOf(key),
      movementCount: 0,
      itemCount: 0,
      throughput: 0,
      entries: [],
      ...emptyFlow(),
    }),
  )
}

/* ------------------------------- Reports ------------------------------- */

export function buildStockByItem(
  filter: StockBreakdownFilter = {},
): StockByItemReport {
  const { cells, opening } = periodFor(filter)
  return { rows: pivotByItem(cells, opening), totals: totalsOf(cells, opening) }
}

export function buildStockBySource(
  filter: StockBreakdownFilter = {},
): StockBySourceReport {
  const { cells, opening } = periodFor(filter)
  return { rows: pivotBySource(cells), totals: totalsOf(cells, opening) }
}

export function buildStockByLocation(
  filter: StockBreakdownFilter = {},
): StockByLocationReport {
  const { cells, opening } = periodFor(filter)
  return { rows: pivotByLocation(cells), totals: totalsOf(cells, opening) }
}

/* ------------------------------- Monthly ------------------------------- */

/**
 * One month of the report: its rows, that month's own roll-forward, and the one
 * running from the start of the period through it. The cumulative row opens
 * where the period opened and closes where the month closed, so reading down
 * the sections tells the same story as the flat view's footer.
 */
export interface MonthlySection<TRow> {
  key: string // YYYY-MM
  label: string // e.g. 'March 2026'
  rows: TRow[]
  totals: StockBreakdownTotals
  cumulative: StockBreakdownTotals
}

export interface StockByMonthReport<TRow> {
  sections: MonthlySection<TRow>[]
  totals: StockBreakdownTotals
}

/**
 * Split the period into months, oldest first, and run the given pivot inside
 * each — every month opening exactly where the previous one closed. Months with
 * no movement are skipped: nothing moved, so nothing changed.
 */
function buildMonthly<TRow>(
  filter: StockBreakdownFilter,
  pivot: (cells: StockCell[], opening: Map<string, ItemState>) => TRow[],
): StockByMonthReport<TRow> {
  const { cells, opening } = periodFor(filter)
  const byMonth = new Map<string, StockCell[]>()
  for (const cell of cells) {
    const key = cell.date.slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(cell)
    else byMonth.set(key, [cell])
  }

  // Each month's closing state is the next month's opening, and the cumulative
  // row spans from the period's opening to wherever the months have reached.
  let state = opening
  const running: StockCell[] = []

  const sections = [...byMonth.keys()].sort().map((key) => {
    const monthCells = byMonth.get(key)!
    const rows = pivot(monthCells, state)
    const totals = totalsOf(monthCells, state)
    running.push(...monthCells)
    state = closingStates(monthCells, state)
    return {
      key,
      label: dayjs(`${key}-01`).format('MMMM YYYY'),
      rows,
      totals,
      cumulative: totalsOf(running, opening),
    }
  })

  return { sections, totals: totalsOf(cells, opening) }
}

/** Month-by-month, each month's items with its own and the running roll-forward. */
export function buildMonthlyStockByItem(
  filter: StockBreakdownFilter = {},
): StockByMonthReport<ItemStockRow> {
  return buildMonthly(filter, pivotByItem)
}

/** Month-by-month, each month's sources with its own and the running totals. */
export function buildMonthlyStockBySource(
  filter: StockBreakdownFilter = {},
): StockByMonthReport<SourceStockRow> {
  return buildMonthly(filter, (cells) => pivotBySource(cells))
}

/** Month-by-month, each month's locations with its own and the running totals. */
export function buildMonthlyStockByLocation(
  filter: StockBreakdownFilter = {},
): StockByMonthReport<LocationStockRow> {
  return buildMonthly(filter, (cells) => pivotByLocation(cells))
}
