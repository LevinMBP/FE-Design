import { listMaterials, manufacture } from './mockInventory'
import { listStockItems } from './mockStockMovements'
import { recordMovement } from './mockMovements'
import type {
  ManufactureBatchRequest,
  ManufactureBatchResult,
  ManufactureRequest,
  ManufactureResult,
  ManufactureRun,
  ManufactureRunLine,
  WorkerRef,
} from './types'

/**
 * Manufacturing runs log + FIFO cost roll-up. Wraps `mockInventory.manufacture`
 * (which validates stock and applies the material/product quantity changes) and
 * additionally: values the consumed materials at their current FIFO average
 * cost, derives the produced product's per-unit cost, and records the run for
 * the production history. Supports bulk runs (several products, one crew, one
 * shared reference). In-memory; resets on full reload.
 */

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let runs: ManufactureRun[] = []
let moNo = 0

export function listManufactureRuns(): ManufactureRun[] {
  return [...runs]
}

/** Shared context stamped on every run within a single (possibly bulk) submit. */
interface RunContext {
  reference: string
  date: string // YYYY-MM-DD (for movements)
  timestamp: string // ISO (for the run record)
  workers: WorkerRef[]
}

/**
 * Produce one product: apply stock changes, log real movements, roll up FIFO
 * cost, and record the run. Stamped with the shared batch context.
 */
function buildRun(req: ManufactureRequest, ctx: RunContext): ManufactureResult {
  // Snapshot material names/units and FIFO avg costs BEFORE consumption.
  const materials = listMaterials()
  const stock = listStockItems()
  const avgCostOf = (id: string) =>
    stock.find((s) => s.id === id && s.kind === 'material')?.avgCost ?? 0

  // Applies the stock changes and validates; throws on any problem.
  const product = manufacture(req)

  const lines: ManufactureRunLine[] = req.lines
    .filter((l) => l.materialId && l.quantity > 0)
    .map((l) => {
      const m = materials.find((x) => x.id === l.materialId)
      const unitCost = avgCostOf(l.materialId)
      return {
        materialId: l.materialId,
        materialName: m?.name ?? '—',
        unit: m?.unit ?? '',
        quantity: l.quantity,
        unitCost,
        cost: round2(l.quantity * unitCost),
      }
    })

  const materialCost = round2(lines.reduce((s, l) => s + l.cost, 0))
  const unitCost = req.outputQuantity > 0 ? round2(materialCost / req.outputQuantity) : 0

  // Log the real stock movements: each material issued OUT from the source
  // location, the finished product received IN at the destination location.
  const sourceLocation = req.sourceLocation || 'MAIN WAREHOUSE'
  const destinationLocation = req.destinationLocation || 'MAIN WAREHOUSE'
  for (const line of lines) {
    recordMovement({
      itemKind: 'material',
      itemId: line.materialId,
      date: ctx.date,
      source: 'Manufacturing',
      reference: ctx.reference,
      location: sourceLocation,
      direction: 'out',
      quantity: line.quantity,
      unitCost: 0,
    })
  }
  recordMovement({
    itemKind: 'product',
    itemId: product.id,
    date: ctx.date,
    source: 'Manufacturing',
    reference: ctx.reference,
    location: destinationLocation,
    direction: 'in',
    quantity: req.outputQuantity,
    unitCost,
  })

  const run: ManufactureRun = {
    id: uid('run'),
    reference: ctx.reference,
    date: ctx.timestamp,
    productId: product.id,
    productName: product.name,
    outputQuantity: req.outputQuantity,
    lines,
    materialCost,
    unitCost,
    workers: ctx.workers,
  }
  runs = [run, ...runs]

  return { product, run }
}

/** Produce a single product (kept for callers that submit one product). */
export function runManufacture(req: ManufactureRequest): ManufactureResult {
  const now = new Date()
  const ctx: RunContext = {
    reference: `MO-${pad3(++moNo)}`,
    date: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
    workers: [],
  }
  return buildRun(req, ctx)
}

/**
 * Produce several products in one submit. Validates the *aggregate* material
 * demand across every product block up front so the batch is all-or-nothing —
 * shared materials can't be double-consumed into a partially-applied state.
 */
export function runManufactureBatch(req: ManufactureBatchRequest): ManufactureBatchResult {
  const items = req.items ?? []
  if (items.length === 0) {
    throw new Error('Add at least one product to produce.')
  }

  // Sum required quantity per material across all product blocks.
  const demand = new Map<string, number>()
  for (const item of items) {
    for (const l of item.lines) {
      if (l.materialId && l.quantity > 0) {
        demand.set(l.materialId, (demand.get(l.materialId) ?? 0) + l.quantity)
      }
    }
  }

  const materials = listMaterials()
  for (const [materialId, needed] of demand) {
    const m = materials.find((x) => x.id === materialId)
    if (!m) throw new Error('A selected material no longer exists.')
    if (m.quantity < needed) {
      throw new Error(
        `Not enough ${m.name}: have ${m.quantity} ${m.unit}, need ${needed} across this batch.`,
      )
    }
  }

  const now = new Date()
  const ctx: RunContext = {
    reference: `MO-${pad3(++moNo)}`,
    date: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
    workers: req.workers ?? [],
  }

  const newRuns = items.map((item) => buildRun(item, ctx).run)
  return { reference: ctx.reference, runs: newRuns }
}
