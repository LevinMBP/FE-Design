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

/** ISO timestamp `days` ago at the given hour — keeps seed dates near today. */
function daysAgoAt(days: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const GAB: WorkerRef = { id: 'emp_gab', name: 'Gabriel Ong' }
const IVAN: WorkerRef = { id: 'emp_ivan', name: 'Ivan Mercado' }

/**
 * Seeded history so the production log has something to show on a fresh load.
 * Display-only: these do NOT deduct materials or add product stock — the seeded
 * on-hand figures in `mockInventory` already stand for the post-run state.
 * MO-002 is a bulk run: two products, one crew, one shared reference.
 */
let runs: ManufactureRun[] = [
  {
    id: 'run_seed_3',
    reference: 'MO-002',
    date: daysAgoAt(1, 9, 15),
    productId: 'prd_table',
    productName: 'Wooden Table',
    outputQuantity: 6,
    lines: [
      { materialId: 'mat_wood', materialName: 'Wood Plank', unit: 'pc', quantity: 24, unitCost: 5, cost: 120 },
      { materialId: 'mat_bolt', materialName: 'Steel Bolt M8', unit: 'pc', quantity: 72, unitCost: 0.2, cost: 14.4 },
      { materialId: 'mat_paint', materialName: 'Paint (White)', unit: 'L', quantity: 6, unitCost: 8, cost: 48 },
    ],
    materialCost: 182.4,
    unitCost: 30.4,
    workers: [GAB, IVAN],
  },
  {
    id: 'run_seed_2',
    reference: 'MO-002',
    date: daysAgoAt(1, 9, 15),
    productId: 'prd_cabinet',
    productName: 'Steel Cabinet',
    outputQuantity: 4,
    lines: [
      { materialId: 'mat_steel', materialName: 'Steel Sheet', unit: 'kg', quantity: 8, unitCost: 12, cost: 96 },
      { materialId: 'mat_bolt', materialName: 'Steel Bolt M8', unit: 'pc', quantity: 32, unitCost: 0.2, cost: 6.4 },
    ],
    materialCost: 102.4,
    unitCost: 25.6,
    workers: [GAB, IVAN],
  },
  {
    id: 'run_seed_1',
    reference: 'MO-001',
    date: daysAgoAt(4, 14, 30),
    productId: 'prd_cabinet',
    productName: 'Steel Cabinet',
    outputQuantity: 10,
    lines: [
      { materialId: 'mat_steel', materialName: 'Steel Sheet', unit: 'kg', quantity: 20, unitCost: 12, cost: 240 },
      { materialId: 'mat_bolt', materialName: 'Steel Bolt M8', unit: 'pc', quantity: 80, unitCost: 0.2, cost: 16 },
    ],
    materialCost: 256,
    unitCost: 25.6,
    workers: [GAB],
  },
]

// Continue numbering after the seeded references so new runs don't collide.
let moNo = 2

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
