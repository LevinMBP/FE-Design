import { getStockItemRef } from './mockInventory'
import { listLocations } from './mockLocations'
import type { Audit, AuditLine, NewAudit } from './types'

/**
 * Stock audits (physical counts) — a stored, read-only record. An audit
 * snapshots each item's system on-hand at count time, records what was actually
 * counted, and derives the variance. It NEVER changes stock: reconciling a
 * variance is a separate, explicit act (an Adjustment, optionally fast-tracked
 * from the audit). In-memory; resets on reload.
 */

const uid = () => `aud_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let audits: Audit[] = []
let audNo = 0

export function listAudits(): Audit[] {
  return [...audits]
}

export function getAudit(id: string): Audit | undefined {
  return audits.find((a) => a.id === id)
}

export function createAudit(input: NewAudit): Audit {
  const usable = input.lines.filter((l) => l.itemId)
  if (usable.length === 0) {
    throw new Error('Add at least one item to count.')
  }

  const location = listLocations().find((l) => l.id === input.locationId)
  if (!location) throw new Error('Select a valid inventory location.')

  // Every line is the document's itemType — the header is the discriminator.
  const seen = new Set<string>()
  const lines: AuditLine[] = []
  for (const l of usable) {
    if (seen.has(l.itemId)) {
      throw new Error('Each item can only be counted once per audit.')
    }
    seen.add(l.itemId)

    const ref = getStockItemRef(input.itemType, l.itemId)
    if (!ref) throw new Error('A selected item no longer exists.')
    if (l.countedQty < 0) {
      throw new Error(`Counted quantity for ${ref.name} cannot be negative.`)
    }
    lines.push({
      kind: input.itemType,
      itemId: l.itemId,
      itemName: ref.name,
      unit: ref.unit,
      systemQty: ref.quantity,
      countedQty: l.countedQty,
      variance: round2(l.countedQty - ref.quantity),
    })
  }

  const hasVariance = lines.some((l) => Math.abs(l.variance) > 0.0005)
  const record: Audit = {
    id: uid(),
    reference: `AUD-${pad3(++audNo)}`,
    date: input.date,
    itemType: input.itemType,
    locationId: location.id,
    location: location.name,
    note: input.note.trim(),
    lines,
    status: hasVariance ? 'open' : 'balanced',
  }
  audits = [record, ...audits]
  return record
}

/**
 * Link an audit to the adjustment fast-tracked from it and flip it to
 * "adjusted", so it no longer shows as an open variance to reconcile.
 */
export function markAuditAdjusted(
  auditId: string,
  adjustmentId: string,
  adjustmentRef: string,
): void {
  audits = audits.map((a) =>
    a.id === auditId
      ? { ...a, status: 'adjusted', adjustmentId, adjustmentRef }
      : a,
  )
}
