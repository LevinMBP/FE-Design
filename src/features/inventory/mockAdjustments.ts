import {
  addStock,
  getStockItemRef,
  listMaterials,
  listProducts,
  removeStock,
} from './mockInventory'
import { recordMovement } from './mockMovements'
import { currentAvgCost, fifoCostToIssue } from './mockStockMovements'
import { getAudit, markAuditAdjusted } from './mockAudits'
import { postAdjustmentEntry } from '../accounting/autoPost'
import type {
  Adjustment,
  AdjustmentLine,
  NewAdjustment,
  StockItemKind,
} from './types'

/**
 * Stock adjustments — the only path that corrects on-hand outside the normal
 * purchase/sale/manufacturing flows. Each line targets a counted quantity; the
 * delta against the CURRENT authoritative on-hand becomes a stock movement:
 * a surplus adds a FIFO lot (valued at the item's current average cost), a
 * shortage issues stock at FIFO cost. The net inventory value change is booked
 * once via `postAdjustmentEntry`, so the subledger and the Inventory control
 * account stay reconciled. All lines are validated up front (all-or-nothing).
 * Fast-tracking from an audit just pre-fills the counted quantities and links
 * the two records. In-memory; resets on reload.
 */

const uid = () => `adj_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let adjustments: Adjustment[] = []
let adjNo = 0

export function listAdjustments(): Adjustment[] {
  return [...adjustments]
}

/** Cost to value units ADDED by an adjustment: current avg cost, else base cost. */
function increaseUnitCost(kind: StockItemKind, id: string): number {
  const avg = currentAvgCost(kind, id)
  if (avg > 0) return avg
  if (kind === 'material') {
    return listMaterials().find((m) => m.id === id)?.unitCost ?? 0
  }
  const p = listProducts().find((x) => x.id === id)
  return p ? round2(p.price * 0.65) : 0
}

interface PreparedLine {
  kind: StockItemKind
  itemId: string
  itemName: string
  unit: string
  previousQty: number
  countedQty: number
  delta: number
}

export function createAdjustment(input: NewAdjustment): Adjustment {
  const usable = input.lines.filter((l) => l.itemId)
  if (usable.length === 0) {
    throw new Error('Add at least one item to adjust.')
  }

  // Validate + compute deltas against CURRENT on-hand before mutating anything.
  const seen = new Set<string>()
  const prepared: PreparedLine[] = []
  for (const l of usable) {
    const key = `${l.kind}:${l.itemId}`
    if (seen.has(key)) {
      throw new Error('Each item can only be adjusted once per document.')
    }
    seen.add(key)

    const ref = getStockItemRef(l.kind, l.itemId)
    if (!ref) throw new Error('A selected item no longer exists.')
    if (l.countedQty < 0) {
      throw new Error(`Counted quantity for ${ref.name} cannot be negative.`)
    }
    prepared.push({
      kind: l.kind,
      itemId: l.itemId,
      itemName: ref.name,
      unit: ref.unit,
      previousQty: ref.quantity,
      countedQty: l.countedQty,
      delta: round2(l.countedQty - ref.quantity),
    })
  }

  const effective = prepared.filter((p) => Math.abs(p.delta) > 0.0005)
  if (effective.length === 0) {
    throw new Error('No changes to apply — counted quantities match the system.')
  }

  const reference = `ADJ-${pad3(++adjNo)}`
  const lines: AdjustmentLine[] = []
  let inValue = 0
  let outValue = 0

  for (const p of effective) {
    let unitCost: number
    let value: number
    if (p.delta > 0) {
      // Surplus — add a FIFO lot at the item's current average cost.
      unitCost = increaseUnitCost(p.kind, p.itemId)
      value = round2(p.delta * unitCost)
      addStock(p.kind, p.itemId, p.delta)
      recordMovement({
        itemKind: p.kind,
        itemId: p.itemId,
        date: input.date,
        source: 'Adjustment',
        reference,
        location: 'MAIN WAREHOUSE',
        direction: 'in',
        quantity: p.delta,
        unitCost,
      })
      inValue += value
    } else {
      // Shortage — issue stock at FIFO cost (valued BEFORE the movement).
      const outQty = -p.delta
      const cost = fifoCostToIssue(p.kind, p.itemId, outQty)
      removeStock(p.kind, p.itemId, outQty)
      recordMovement({
        itemKind: p.kind,
        itemId: p.itemId,
        date: input.date,
        source: 'Adjustment',
        reference,
        location: 'MAIN WAREHOUSE',
        direction: 'out',
        quantity: outQty,
        unitCost: 0,
      })
      unitCost = outQty > 0 ? round2(cost / outQty) : 0
      value = round2(cost)
      outValue += value
    }
    lines.push({
      kind: p.kind,
      itemId: p.itemId,
      itemName: p.itemName,
      unit: p.unit,
      previousQty: p.previousQty,
      countedQty: p.countedQty,
      delta: p.delta,
      unitCost,
      value: p.delta > 0 ? value : -value,
    })
  }

  inValue = round2(inValue)
  outValue = round2(outValue)
  const netValue = round2(inValue - outValue)

  const audit = input.auditId ? getAudit(input.auditId) : undefined
  const record: Adjustment = {
    id: uid(),
    reference,
    date: input.date,
    reason: input.reason,
    note: input.note.trim(),
    auditId: input.auditId,
    auditRef: audit?.reference,
    lines,
    inValue,
    outValue,
    netValue,
  }
  adjustments = [record, ...adjustments]

  // Book the net inventory change (Dr/Cr Inventory ↔ Inventory Adjustments).
  postAdjustmentEntry({ date: input.date, reference, netValue })

  // Close the loop back to the audit that spawned this, if any.
  if (input.auditId && audit) {
    markAuditAdjusted(input.auditId, record.id, reference)
  }

  return record
}
