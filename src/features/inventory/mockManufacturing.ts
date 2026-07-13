import { listMaterials, manufacture } from './mockInventory'
import { listStockItems } from './mockStockMovements'
import { recordMovement } from './mockMovements'
import type {
  ManufactureRequest,
  ManufactureResult,
  ManufactureRun,
  ManufactureRunLine,
} from './types'

/**
 * Manufacturing runs log + FIFO cost roll-up. Wraps `mockInventory.manufacture`
 * (which validates stock and applies the material/product quantity changes) and
 * additionally: values the consumed materials at their current FIFO average
 * cost, derives the produced product's per-unit cost, and records the run for
 * the production history. In-memory; resets on full reload.
 */

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let runs: ManufactureRun[] = []
let moNo = 0

export function listManufactureRuns(): ManufactureRun[] {
  return [...runs]
}

export function runManufacture(req: ManufactureRequest): ManufactureResult {
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

  // Log the real stock movements: each material issued OUT, the product IN.
  const reference = `MO-${pad3(++moNo)}`
  const date = new Date().toISOString().slice(0, 10)
  for (const line of lines) {
    recordMovement({
      itemKind: 'material',
      itemId: line.materialId,
      date,
      source: 'Manufacturing',
      reference,
      location: 'MAIN WAREHOUSE',
      direction: 'out',
      quantity: line.quantity,
      unitCost: 0,
    })
  }
  recordMovement({
    itemKind: 'product',
    itemId: product.id,
    date,
    source: 'Manufacturing',
    reference,
    location: 'MAIN WAREHOUSE',
    direction: 'in',
    quantity: req.outputQuantity,
    unitCost,
  })

  const run: ManufactureRun = {
    id: uid('run'),
    date: new Date().toISOString(),
    productId: product.id,
    productName: product.name,
    outputQuantity: req.outputQuantity,
    lines,
    materialCost,
    unitCost,
  }
  runs = [run, ...runs]

  return { product, run }
}
