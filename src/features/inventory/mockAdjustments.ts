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
import { listLocations } from './mockLocations'
import { postAdjustmentEntry } from '../accounting/autoPost'
import type {
  Adjustment,
  AdjustmentLine,
  NewAdjustment,
  StockItemKind,
} from './types'

/**
 * Stock adjustments — the only path that corrects on-hand outside the normal
 * purchase/sale/manufacturing flows. The document's `itemType` says what every
 * line is (product or material) — lines carry only an item id and a signed
 * `delta` applied against the CURRENT authoritative on-hand: an addition adds
 * a FIFO lot (valued at the item's current average cost), a deduction issues
 * stock at FIFO cost. The net inventory value change is booked once via
 * `postAdjustmentEntry`, so the subledger and the Inventory control account
 * stay reconciled. All lines are validated up front (all-or-nothing).
 * Fast-tracking from an audit pre-fills the variance deltas and links the two
 * records. In-memory; resets on reload.
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

  const location = listLocations().find((l) => l.id === input.locationId)
  if (!location) throw new Error('Select a valid inventory location.')

  if (input.reason === 'other' && !input.otherReason?.trim()) {
    throw new Error('Describe the reason when "Other" is selected.')
  }

  // Validate + apply deltas against CURRENT on-hand before mutating anything.
  // Every line is the document's itemType — the header is the discriminator.
  const seen = new Set<string>()
  const prepared: PreparedLine[] = []
  for (const l of usable) {
    if (seen.has(l.itemId)) {
      throw new Error('Each item can only be adjusted once per document.')
    }
    seen.add(l.itemId)

    const ref = getStockItemRef(input.itemType, l.itemId)
    if (!ref) throw new Error('A selected item no longer exists.')
    const delta = round2(l.delta)
    if (Math.abs(delta) <= 0.0005) {
      throw new Error(`Adjustment amount for ${ref.name} must be greater than zero.`)
    }
    const countedQty = round2(ref.quantity + delta)
    if (countedQty < 0) {
      throw new Error(
        `Deducting ${-delta} would take ${ref.name} below zero (on hand: ${ref.quantity}).`,
      )
    }
    prepared.push({
      kind: input.itemType,
      itemId: l.itemId,
      itemName: ref.name,
      unit: ref.unit,
      previousQty: ref.quantity,
      countedQty,
      delta,
    })
  }

  const reference = `ADJ-${pad3(++adjNo)}`
  const lines: AdjustmentLine[] = []
  let inValue = 0
  let outValue = 0

  for (const p of prepared) {
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
        location: location.name,
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
        location: location.name,
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
    itemType: input.itemType,
    locationId: location.id,
    location: location.name,
    reason: input.reason,
    otherReason: input.reason === 'other' ? input.otherReason?.trim() : undefined,
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
