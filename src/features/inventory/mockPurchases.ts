import { addStock, getStockItemRef } from './mockInventory'
import { ensureOpeningBalances, recordMovement } from './mockMovements'
import { PURCHASE_DEBIT_ACCOUNT, postPurchaseEntry } from '../accounting/autoPost'
import { listVendors } from '../contacts/mockContacts'
import { listTaxes } from '../finance/mockFinance'
import { listLocations } from './mockLocations'
import {
  purchaseAddsStock,
  type NewPurchase,
  type Purchase,
  type PurchaseLine,
  type PurchaseLineTax,
  type PurchaseTaxSummary,
} from './types'

/**
 * Purchases — the only external way to ADD product/material inventory. Each line
 * carries its own type: Material/Product lines receive stock into a location
 * (increment on-hand + append an "in" movement); Asset/Service/Expense lines
 * don't touch stock, they're just a bill. Lines can carry multiple added-on
 * taxes (input VAT etc.). Every purchase posts a double-entry (debit each type's
 * account + Input Tax, credit AP for the total). In-memory; resets on reload.
 */

const uid = () => `pur_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let purchases: Purchase[] = []
let poNo = 0

export function listPurchases(): Purchase[] {
  return [...purchases]
}

/** The next auto PO reference, without consuming it (for form defaults). */
export function nextPurchaseRef(): string {
  return `PO-${pad3(poNo + 1)}`
}

export function getPurchase(id: string): Purchase | undefined {
  return purchases.find((p) => p.id === id)
}

/** Add a settled amount to a purchase's running paid total. */
export function applyPurchasePayment(id: string, amount: number): Purchase {
  let updated: Purchase | undefined
  purchases = purchases.map((p) => {
    if (p.id !== id) return p
    updated = { ...p, amountPaid: round2(p.amountPaid + amount) }
    return updated
  })
  if (!updated) throw new Error('That purchase no longer exists.')
  return updated
}

export function createPurchase(input: NewPurchase): Purchase {
  const taxDefs = listTaxes()
  const locations = listLocations()

  // A line is usable if it has an amount; stock lines also need an item + qty.
  const usable = input.lines.filter((l) =>
    purchaseAddsStock(l.type) ? l.itemId && l.quantity > 0 : (l.amount ?? 0) > 0,
  )
  if (usable.length === 0) {
    throw new Error('Add at least one line with an amount.')
  }

  // Resolve + validate every line before mutating anything.
  const lines: PurchaseLine[] = usable.map((l) => {
    const stock = purchaseAddsStock(l.type)
    const quantity = stock ? l.quantity : l.quantity || 1
    const unitCost = l.amount
    const lineSubtotal = round2(quantity * unitCost)

    const taxes: PurchaseLineTax[] = (l.taxIds ?? [])
      .map((id) => taxDefs.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((t) => ({
        taxId: t.id,
        label: `${t.name} ${t.rate}%`,
        rate: t.rate,
        amount: round2(lineSubtotal * (t.rate / 100)),
      }))
    const taxAmount = round2(taxes.reduce((s, t) => s + t.amount, 0))
    const base = {
      type: l.type,
      quantity,
      unitCost,
      lineSubtotal,
      taxes,
      taxAmount,
      lineTotal: round2(lineSubtotal + taxAmount),
    }

    if (stock) {
      const ref = getStockItemRef(l.itemKind!, l.itemId!)
      if (!ref) throw new Error('A selected item no longer exists.')
      const loc = locations.find((x) => x.id === l.locationId)
      return {
        ...base,
        itemKind: l.itemKind,
        itemId: l.itemId,
        itemName: ref.name,
        unit: ref.unit,
        locationId: l.locationId,
        locationName: loc?.name ?? '',
      }
    }
    return {
      ...base,
      itemName: (l.description ?? '').trim() || 'Item',
      unit: '',
    }
  })

  const auto = nextPurchaseRef()
  const reference = input.reference?.trim() || auto
  if (reference === auto) poNo++ // advance the auto counter only when it's used

  for (const line of lines) {
    if (!purchaseAddsStock(line.type)) continue
    addStock(line.itemKind!, line.itemId!, line.quantity)
    recordMovement({
      itemKind: line.itemKind!,
      itemId: line.itemId!,
      date: input.date,
      source: 'Purchase',
      reference,
      location: line.locationName || 'MAIN WAREHOUSE',
      direction: 'in',
      quantity: line.quantity,
      unitCost: line.unitCost,
    })
  }

  const vendor = listVendors().find((v) => v.id === input.vendorId)
  const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0))

  // Document discount off the subtotal; every tax scales down by the same
  // proportion so the books stay consistent (mirrors the sales-doc math).
  const rawDiscount =
    input.discountType === 'percent'
      ? subtotal * ((input.discountValue ?? 0) / 100)
      : input.discountValue ?? 0
  const discountAmount = round2(Math.min(Math.max(rawDiscount, 0), subtotal))
  const gross = round2(subtotal - discountAmount)
  const keptFraction = subtotal > 0 ? gross / subtotal : 1

  // Roll the per-line taxes up by tax, scaled for the discount.
  const summaryMap = new Map<string, PurchaseTaxSummary>()
  for (const l of lines) {
    for (const t of l.taxes) {
      const cur = summaryMap.get(t.taxId)
      if (cur) cur.amount += t.amount
      else summaryMap.set(t.taxId, { taxId: t.taxId, label: t.label, rate: t.rate, amount: t.amount })
    }
  }
  const taxSummary = [...summaryMap.values()].map((t) => ({
    ...t,
    amount: round2(t.amount * keptFraction),
  }))
  const taxAmount = round2(taxSummary.reduce((s, t) => s + t.amount, 0))
  const total = round2(gross + taxAmount)

  const record: Purchase = {
    id: uid(),
    reference,
    date: input.date,
    dueDate: input.dueDate,
    vendorId: input.vendorId,
    vendorName: vendor?.company ?? '',
    note: input.note ?? '',
    lines,
    subtotal,
    discountAmount,
    gross,
    taxAmount,
    taxSummary,
    total,
    netPayable: total,
    amountPaid: 0,
  }
  purchases = [record, ...purchases]

  // Dr <account(s) by line type> / Dr Input Tax / Cr Accounts Payable (total).
  // Debits are scaled for the discount; any rounding drift lands on the first
  // account so the entry always balances (Σ debits = gross).
  const debitMap = new Map<string, number>()
  for (const l of lines) {
    const accountId = PURCHASE_DEBIT_ACCOUNT[l.type]
    debitMap.set(accountId, (debitMap.get(accountId) ?? 0) + l.lineSubtotal)
  }
  const debits = [...debitMap.entries()].map(([accountId, amount]) => ({
    accountId,
    amount: round2(amount * keptFraction),
  }))
  const drift = round2(gross - debits.reduce((s, d) => s + d.amount, 0))
  if (debits.length > 0 && drift !== 0) {
    debits[0].amount = round2(debits[0].amount + drift)
  }
  postPurchaseEntry({
    date: input.date,
    reference,
    party: record.vendorName,
    debits,
    inputTax: taxAmount,
    total,
  })
  return record
}

/**
 * Seed a handful of realistic POs so the purchases list, stock ledger and
 * books aren't empty on first load. Seeded through `createPurchase` so the
 * received stock, movements and journal postings stay consistent — exactly as
 * if a user had entered them. Opening balances are captured first so the
 * seeded receipts land on top of each item's opening lot, not inside it.
 */
function seedPurchases() {
  ensureOpeningBalances()
  const vat = ['tax_vat']

  createPurchase({
    reference: '',
    date: '2026-02-10',
    dueDate: '2026-03-24',
    vendorId: 'ven_steelco',
    note: 'Q1 steel restock.',
    lines: [
      { type: 'material', itemKind: 'material', itemId: 'mat_steel', locationId: 'loc_main', quantity: 200, amount: 11.5, taxIds: vat },
      { type: 'product', itemKind: 'product', itemId: 'prd_hinges', locationId: 'loc_main', quantity: 500, amount: 1.6, taxIds: vat },
    ],
  })
  createPurchase({
    reference: '',
    date: '2026-03-05',
    dueDate: '2026-04-16',
    vendorId: 'ven_packright',
    note: '',
    lines: [
      { type: 'material', itemKind: 'material', itemId: 'mat_wood', locationId: 'loc_main', quantity: 150, amount: 4.75, taxIds: vat },
      { type: 'material', itemKind: 'material', itemId: 'mat_paint', locationId: 'loc_main', quantity: 60, amount: 7.8, taxIds: vat },
    ],
  })
  createPurchase({
    reference: '',
    date: '2026-04-14',
    dueDate: '2026-05-26',
    vendorId: 'ven_steelco',
    note: 'Drills for the store floor.',
    lines: [
      { type: 'product', itemKind: 'product', itemId: 'prd_drill', locationId: 'loc_store', quantity: 20, amount: 55, taxIds: vat },
    ],
  })
  createPurchase({
    reference: '',
    date: '2026-05-06',
    dueDate: '2026-06-17',
    vendorId: 'ven_movit',
    note: 'Freight on the May inbound container.',
    lines: [
      { type: 'service', description: 'Inbound freight — May container', quantity: 1, amount: 8500, taxIds: [] },
    ],
  })
  createPurchase({
    reference: '',
    date: '2026-07-08',
    dueDate: '2026-08-19',
    vendorId: 'ven_packright',
    note: '',
    lines: [
      { type: 'asset', description: 'Pallet racking system (Main Warehouse)', quantity: 1, amount: 35000, taxIds: vat },
      { type: 'expense', description: 'Racking delivery and installation', quantity: 1, amount: 2400, taxIds: vat },
    ],
  })
}
seedPurchases()
