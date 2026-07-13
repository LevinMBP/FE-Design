import { getStockItemRef } from './mockInventory'
import { issueStockOut } from './issueStock'
import { postSaleEntries } from '../accounting/autoPost'
import { listCustomers } from '../contacts/mockContacts'
import type { NewSale, Sale, SaleLine } from './types'

/**
 * Sales — the only way to REDUCE inventory externally. Creating a sale issues
 * stock immediately: it decrements each item's on-hand and appends an "out"
 * movement (valued by FIFO at display time). All lines are validated against
 * available stock up front, so a sale is applied all-or-nothing — it never
 * partially posts and then fails. In-memory; resets on reload.
 */

const uid = () => `sal_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let sales: Sale[] = []
let soNo = 0

export function listSales(): Sale[] {
  return [...sales]
}

export function createSale(input: NewSale): Sale {
  const usable = input.lines.filter((l) => l.itemId && l.quantity > 0)
  if (usable.length === 0) {
    throw new Error('Add at least one item with a quantity.')
  }

  const lines: SaleLine[] = usable.map((l) => {
    const ref = getStockItemRef(l.itemKind, l.itemId)
    if (!ref) throw new Error('A selected item no longer exists.')
    return {
      itemKind: l.itemKind,
      itemId: l.itemId,
      itemName: ref.name,
      unit: ref.unit,
      quantity: l.quantity,
      unitPrice: l.amount,
    }
  })

  // Validate + issue stock through the single shared out-path (all-or-nothing).
  // The returned COGS is the FIFO cost of everything issued.
  const reference = `SO-${pad3(++soNo)}`
  const cogsCost = issueStockOut(
    lines.map((l) => ({ itemKind: l.itemKind, itemId: l.itemId, quantity: l.quantity })),
    input.date,
    reference,
  )

  const customer = listCustomers().find((c) => c.id === input.customerId)
  const total = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0))
  const record: Sale = {
    id: uid(),
    reference,
    date: input.date,
    customerId: input.customerId,
    customerName: customer?.company ?? '',
    lines,
    total,
  }
  sales = [record, ...sales]

  // Post revenue (Dr AR / Cr Sales) and COGS (Dr COGS / Cr Inventory).
  postSaleEntries({
    date: input.date,
    reference,
    party: record.customerName,
    revenueNet: total,
    taxAmount: 0,
    cogsCost,
  })
  return record
}
