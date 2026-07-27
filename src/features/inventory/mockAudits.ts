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

/** ISO date (YYYY-MM-DD) `days` ago — keeps seed dates near today. */
function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Seeded count history so the audits list isn't empty on a fresh load — one of
 * each status. Audits never move stock, so these are safe to state literally;
 * the figures are chosen to stay consistent with the seeded on-hand in
 * `mockInventory`:
 *  - AUD-001 balanced → counted == system == today's on-hand
 *  - AUD-002 adjusted → system is the PRE-adjustment figure; ADJ-003 (seeded in
 *    `mockAdjustments`) moved it to the counted qty, which is today's on-hand
 *  - AUD-003 open     → nothing reconciled yet, so system == today's on-hand
 */
// prettier-ignore
let audits: Audit[] = [
  {
    id: 'aud_seed_3',
    reference: 'AUD-003',
    date: daysAgo(2),
    itemType: 'product',
    locationId: 'loc_store',
    location: 'Store Front',
    note: 'Monthly retail floor count.',
    status: 'open',
    lines: [
      { kind: 'product', itemId: 'prd_drill', itemName: 'Imported Drill', unit: 'ea', systemQty: 30, countedQty: 28, variance: -2 },
      { kind: 'product', itemId: 'prd_hinges', itemName: 'Local Hinges', unit: 'ea', systemQty: 200, countedQty: 205, variance: 5 },
      { kind: 'product', itemId: 'prd_cabinet', itemName: 'Steel Cabinet', unit: 'ea', systemQty: 15, countedQty: 15, variance: 0 },
    ],
  },
  {
    id: 'aud_seed_2',
    reference: 'AUD-002',
    date: daysAgo(6),
    itemType: 'material',
    locationId: 'loc_main',
    location: 'Main Warehouse',
    note: 'Spot count on fast-moving consumables.',
    status: 'adjusted',
    adjustmentId: 'adj_seed_3',
    adjustmentRef: 'ADJ-003',
    lines: [
      { kind: 'material', itemId: 'mat_bolt', itemName: 'Steel Bolt M8', unit: 'pc', systemQty: 46, countedQty: 40, variance: -6 },
      { kind: 'material', itemId: 'mat_paint', itemName: 'Paint (White)', unit: 'L', systemQty: 78, countedQty: 80, variance: 2 },
      { kind: 'material', itemId: 'mat_wood', itemName: 'Wood Plank', unit: 'pc', systemQty: 300, countedQty: 300, variance: 0 },
    ],
  },
  {
    id: 'aud_seed_1',
    reference: 'AUD-001',
    date: daysAgo(18),
    itemType: 'material',
    locationId: 'loc_main',
    location: 'Main Warehouse',
    note: 'Quarterly count — bulk materials only.',
    status: 'balanced',
    lines: [
      { kind: 'material', itemId: 'mat_steel', itemName: 'Steel Sheet', unit: 'kg', systemQty: 500, countedQty: 500, variance: 0 },
      { kind: 'material', itemId: 'mat_wood', itemName: 'Wood Plank', unit: 'pc', systemQty: 300, countedQty: 300, variance: 0 },
    ],
  },
]

// Continue numbering after the seeded references so new audits don't collide.
let audNo = 3

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
