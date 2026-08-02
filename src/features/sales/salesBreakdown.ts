import dayjs from 'dayjs'
import { listMaterials, listProducts } from '../inventory/mockInventory'
import { saleCostsByReference } from '../inventory/mockStockMovements'
import { movementsVersion } from '../inventory/mockMovements'
import { listTaxes } from '../finance/mockFinance'
import { invoicesVersion, listInvoices } from './mockSalesDocs'
import { lineNetValue } from './salesDocMath'
import type { StockItemKind } from '../inventory/types'
import type { InvoiceStatus, PaymentTerm, SalesDocLine } from './types'

/**
 * Sales breakdown — what was actually sold, viewable per item or per invoice.
 *
 * Both views are pivots of one atom: an item's contribution to one invoice
 * (`SaleCell`). Revenue is the line's *net* value (tax carved out) less its
 * share of the document discount, so the report ties back to the Sales account
 * rather than to invoice totals. Cost is the FIFO cost of the stock the invoice
 * issued, read back from the stock ledger — the same numbers posted to COGS, so
 * revenue − cost is the margin the books already recognise.
 *
 * Only *issued* invoices count: a draft has neither moved stock nor earned
 * revenue. Payment status is irrelevant — revenue is recognised on issue.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

const marginPctOf = (revenue: number, margin: number) =>
  revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0

/** Inclusive ISO date bounds; omit either side for "open-ended". */
export interface SalesBreakdownFilter {
  from?: string
  to?: string
}

/** Money figures every row and the report footer share. */
interface Money {
  quantity: number
  revenue: number
  cost: number
  margin: number
}

export interface SalesBreakdownTotals extends Money {
  marginPct: number
  itemCount: number
  invoiceCount: number
}

/* ------------------------------ Per item ------------------------------ */

/** One invoice's contribution to an item's totals. */
export interface ItemSaleEntry extends Money {
  invoiceId: string
  reference: string
  date: string
  customerName: string
  status: InvoiceStatus
}

export interface ItemSalesRow extends Money {
  key: string
  itemKind: StockItemKind
  itemId: string
  itemName: string
  sku: string
  unit: string
  marginPct: number
  invoiceCount: number
  entries: ItemSaleEntry[]
}

export interface SalesByItemReport {
  rows: ItemSalesRow[]
  totals: SalesBreakdownTotals
}

/* ----------------------------- Per invoice ----------------------------- */

/** One item's contribution to an invoice's totals. */
export interface InvoiceItemEntry extends Money {
  key: string
  itemKind: StockItemKind
  itemId: string
  itemName: string
  sku: string
  unit: string
}

export interface InvoiceSalesRow extends Money {
  key: string
  invoiceId: string
  reference: string
  date: string
  dueDate: string
  paymentTerm: PaymentTerm
  customerName: string
  status: InvoiceStatus
  marginPct: number
  itemCount: number
  // Document-level figures, so a row reconciles with the invoice itself.
  discountAmount: number
  taxAmount: number
  total: number
  entries: InvoiceItemEntry[]
}

export interface SalesByInvoiceReport {
  rows: InvoiceSalesRow[]
  totals: SalesBreakdownTotals
}

/* ------------------------------- Sourcing ------------------------------- */

/** One item's share of one invoice — the atom both groupings pivot. */
interface SaleCell extends Money {
  invoiceId: string
  reference: string
  date: string
  dueDate: string
  paymentTerm: PaymentTerm
  customerName: string
  status: InvoiceStatus
  discountAmount: number
  taxAmount: number
  total: number
  itemKey: string
  itemKind: StockItemKind
  itemId: string
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
 * Names, SKUs and units for every item, straight off the master lists. This
 * deliberately avoids the stock ledger: `getItemLedger` replays FIFO and builds
 * a row per movement just to hand back a name.
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

/** Every (invoice × item) cell in the period, valued for revenue and cost. */
function collectCells(filter: SalesBreakdownFilter): SaleCell[] {
  const taxes = listTaxes()
  const billed = listInvoices().filter(
    (inv) =>
      inv.issued &&
      inv.status !== 'void' &&
      (!filter.from || inv.date >= filter.from) &&
      (!filter.to || inv.date <= filter.to),
  )

  // Two lookups built once for the whole report, not per invoice or per item.
  const facts = itemFacts()
  const costs = saleCostsByReference()
  const cells: SaleCell[] = []

  for (const inv of billed) {
    // Each line carries its proportional share of the document discount.
    const discountFraction =
      inv.subtotal > 0 ? inv.discountAmount / inv.subtotal : 0

    // Fold the invoice's lines down to one cell per item first, so an item
    // billed on two lines isn't charged its FIFO cost twice. The first line for
    // an item carries the fallback name/unit snapshot.
    const perItem = new Map<
      string,
      { line: SalesDocLine; quantity: number; revenue: number }
    >()
    for (const line of inv.lines) {
      const itemKey = `${line.itemKind}:${line.itemId}`
      const acc = perItem.get(itemKey) ?? { line, quantity: 0, revenue: 0 }
      acc.quantity += line.quantity
      acc.revenue += lineNetValue(line, taxes) * (1 - discountFraction)
      perItem.set(itemKey, acc)
    }

    for (const [itemKey, acc] of perItem) {
      const known = facts.get(itemKey)
      const line = acc.line
      const revenue = round2(acc.revenue)
      const cost = costs.get(itemKey)?.get(inv.reference) ?? 0
      cells.push({
        invoiceId: inv.id,
        reference: inv.reference,
        date: inv.date,
        dueDate: inv.dueDate,
        paymentTerm: inv.paymentTerm,
        customerName: inv.customerName,
        status: inv.status,
        discountAmount: inv.discountAmount,
        taxAmount: inv.taxAmount,
        total: inv.total,
        itemKey,
        itemKind: line.itemKind,
        itemId: line.itemId,
        // Deleted items keep the name/unit snapshot the invoice captured.
        itemName: known?.name ?? line.itemName,
        sku: known?.sku ?? '—',
        unit: known?.unit ?? line.unit,
        quantity: round2(acc.quantity),
        revenue,
        cost,
        margin: round2(revenue - cost),
      })
    }
  }
  return cells
}

/**
 * The four views (item / invoice, flat / monthly) are pivots of the *same*
 * cells, and switching between them is the common interaction — so the last
 * aggregation is kept and reused. The key carries both data versions, so any
 * new invoice, issue or payment misses the cache rather than serving stale
 * figures.
 */
let cellCache: { key: string; cells: SaleCell[] } | null = null

function cellsFor(filter: SalesBreakdownFilter): SaleCell[] {
  const key = [
    filter.from ?? '',
    filter.to ?? '',
    invoicesVersion(),
    movementsVersion(),
  ].join('|')
  if (cellCache?.key === key) return cellCache.cells
  const cells = collectCells(filter)
  cellCache = { key, cells }
  return cells
}

/** Sum a set of cells into the report footer. */
function totalsOf(cells: SaleCell[]): SalesBreakdownTotals {
  const quantity = round2(cells.reduce((s, c) => s + c.quantity, 0))
  const revenue = round2(cells.reduce((s, c) => s + c.revenue, 0))
  const cost = round2(cells.reduce((s, c) => s + c.cost, 0))
  const margin = round2(revenue - cost)
  return {
    quantity,
    revenue,
    cost,
    margin,
    marginPct: marginPctOf(revenue, margin),
    itemCount: new Set(cells.map((c) => c.itemKey)).size,
    invoiceCount: new Set(cells.map((c) => c.invoiceId)).size,
  }
}

/** Accumulate a cell's money onto a row. */
function addMoney(row: Money, cell: Money) {
  row.quantity = round2(row.quantity + cell.quantity)
  row.revenue = round2(row.revenue + cell.revenue)
  row.cost = round2(row.cost + cell.cost)
  row.margin = round2(row.revenue - row.cost)
}

/* ------------------------------- Pivots ------------------------------- */

/** Grouped by item: what each product/material sold for, ranked by revenue. */
function pivotByItem(cells: SaleCell[]): ItemSalesRow[] {
  const rows = new Map<string, ItemSalesRow>()

  for (const cell of cells) {
    let row = rows.get(cell.itemKey)
    if (!row) {
      row = {
        key: cell.itemKey,
        itemKind: cell.itemKind,
        itemId: cell.itemId,
        itemName: cell.itemName,
        sku: cell.sku,
        unit: cell.unit,
        quantity: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: 0,
        invoiceCount: 0,
        entries: [],
      }
      rows.set(cell.itemKey, row)
    }
    addMoney(row, cell)
    row.marginPct = marginPctOf(row.revenue, row.margin)
    row.invoiceCount += 1
    row.entries.push({
      invoiceId: cell.invoiceId,
      reference: cell.reference,
      date: cell.date,
      customerName: cell.customerName,
      status: cell.status,
      quantity: cell.quantity,
      revenue: cell.revenue,
      cost: cell.cost,
      margin: cell.margin,
    })
  }

  const ranked = [...rows.values()].sort((a, b) => b.revenue - a.revenue)
  for (const row of ranked) row.entries.sort((a, b) => b.date.localeCompare(a.date))
  return ranked
}

/** Grouped by invoice: what each sale earned, newest first. */
function pivotByInvoice(cells: SaleCell[]): InvoiceSalesRow[] {
  const rows = new Map<string, InvoiceSalesRow>()

  for (const cell of cells) {
    let row = rows.get(cell.invoiceId)
    if (!row) {
      row = {
        key: cell.invoiceId,
        invoiceId: cell.invoiceId,
        reference: cell.reference,
        date: cell.date,
        dueDate: cell.dueDate,
        paymentTerm: cell.paymentTerm,
        customerName: cell.customerName,
        status: cell.status,
        quantity: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: 0,
        itemCount: 0,
        discountAmount: cell.discountAmount,
        taxAmount: cell.taxAmount,
        total: cell.total,
        entries: [],
      }
      rows.set(cell.invoiceId, row)
    }
    addMoney(row, cell)
    row.marginPct = marginPctOf(row.revenue, row.margin)
    row.itemCount += 1
    row.entries.push({
      key: cell.itemKey,
      itemKind: cell.itemKind,
      itemId: cell.itemId,
      itemName: cell.itemName,
      sku: cell.sku,
      unit: cell.unit,
      quantity: cell.quantity,
      revenue: cell.revenue,
      cost: cell.cost,
      margin: cell.margin,
    })
  }

  const ordered = [...rows.values()].sort((a, b) =>
    a.date === b.date ? b.reference.localeCompare(a.reference) : b.date.localeCompare(a.date),
  )
  for (const row of ordered) row.entries.sort((a, b) => b.revenue - a.revenue)
  return ordered
}

/* ------------------------------- Reports ------------------------------- */

export function buildSalesByItem(
  filter: SalesBreakdownFilter = {},
): SalesByItemReport {
  const cells = cellsFor(filter)
  return { rows: pivotByItem(cells), totals: totalsOf(cells) }
}

export function buildSalesByInvoice(
  filter: SalesBreakdownFilter = {},
): SalesByInvoiceReport {
  const cells = cellsFor(filter)
  return { rows: pivotByInvoice(cells), totals: totalsOf(cells) }
}

/* ------------------------------- Monthly ------------------------------- */

/**
 * One month of the report: its rows, that month's totals, and the totals for
 * everything up to and including it. The cumulative figures are recomputed from
 * the months' cells rather than added up, so counts stay *distinct* — an item
 * sold in both January and February counts once in the cumulative item count.
 */
export interface MonthlySection<TRow> {
  key: string // YYYY-MM
  label: string // e.g. 'January 2026'
  rows: TRow[]
  totals: SalesBreakdownTotals
  cumulative: SalesBreakdownTotals
}

export interface SalesByMonthReport<TRow> {
  sections: MonthlySection<TRow>[]
  totals: SalesBreakdownTotals
}

/**
 * Split the period into months, oldest first, and run the given pivot inside
 * each. Months with no sales are skipped — an empty section says nothing, and
 * the cumulative column carries across the gap unchanged.
 */
function buildMonthly<TRow>(
  filter: SalesBreakdownFilter,
  pivot: (cells: SaleCell[]) => TRow[],
): SalesByMonthReport<TRow> {
  const cells = cellsFor(filter)
  const byMonth = new Map<string, SaleCell[]>()
  for (const cell of cells) {
    const key = cell.date.slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(cell)
    else byMonth.set(key, [cell])
  }

  // Carry the running figures forward month by month instead of re-summing
  // everything so far for each one: the Sets keep the counts *distinct* (an item
  // sold in two months counts once) while staying linear overall.
  let quantity = 0
  let revenue = 0
  let cost = 0
  const seenItems = new Set<string>()
  const seenInvoices = new Set<string>()

  const sections = [...byMonth.keys()].sort().map((key) => {
    const monthCells = byMonth.get(key)!
    for (const cell of monthCells) {
      quantity += cell.quantity
      revenue += cell.revenue
      cost += cell.cost
      seenItems.add(cell.itemKey)
      seenInvoices.add(cell.invoiceId)
    }
    const cumulativeMargin = round2(round2(revenue) - round2(cost))
    return {
      key,
      label: dayjs(`${key}-01`).format('MMMM YYYY'),
      rows: pivot(monthCells),
      totals: totalsOf(monthCells),
      cumulative: {
        quantity: round2(quantity),
        revenue: round2(revenue),
        cost: round2(cost),
        margin: cumulativeMargin,
        marginPct: marginPctOf(round2(revenue), cumulativeMargin),
        itemCount: seenItems.size,
        invoiceCount: seenInvoices.size,
      },
    }
  })

  return { sections, totals: totalsOf(cells) }
}

/** Month-by-month, each month's invoices with its totals and running totals. */
export function buildMonthlySalesByInvoice(
  filter: SalesBreakdownFilter = {},
): SalesByMonthReport<InvoiceSalesRow> {
  return buildMonthly(filter, pivotByInvoice)
}

/** Month-by-month, each month's items with its totals and running totals. */
export function buildMonthlySalesByItem(
  filter: SalesBreakdownFilter = {},
): SalesByMonthReport<ItemSalesRow> {
  return buildMonthly(filter, pivotByItem)
}
