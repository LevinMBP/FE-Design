import { useMemo } from 'react'
import type { StockItem } from '../inventory/types'
import {
  useGetMaterialsQuery,
  useGetProductsQuery,
  useGetStockItemsQuery,
} from '../inventory/inventoryApi'
import { useGetCustomersQuery } from '../contacts/contactsApi'
import { useGetTaxesQuery } from '../finance/financeApi'
import type { Customer } from '../contacts/types'
import type { Tax } from '../finance/types'
import { isSalesTax } from './salesDocMath'
import type { StockItemKind } from '../inventory/types'
import type { SalesDocLineInput } from './types'

/** Encode/decode an item as a single select value ("kind:id"). */
export const itemValue = (i: StockItem) => `${i.kind}:${i.id}`

/** Raw line values as held by the form. */
export interface LineFieldValues {
  item?: string
  packaging?: string
  description?: string
  quantity?: number
  unitPrice?: number
  taxIncluded?: boolean
}

/** An item whose combined line quantity exceeds what's on hand. */
export interface Shortage {
  name: string
  need: number
  have: number
  unit: string
}

/**
 * Items on the current lines whose combined quantity exceeds on-hand stock.
 * Used to warn before issuing an invoice (sending is all-or-nothing).
 */
export function stockShortages(
  lines: LineFieldValues[] | undefined,
  items: StockItem[],
): Shortage[] {
  const byKey = new Map(items.map((i) => [itemValue(i), i]))
  const demand = new Map<string, number>()
  for (const l of lines ?? []) {
    if (!l?.item || !((l.quantity ?? 0) > 0)) continue
    demand.set(l.item, (demand.get(l.item) ?? 0) + (l.quantity as number))
  }
  const out: Shortage[] = []
  for (const [key, qty] of demand) {
    const it = byKey.get(key)
    if (it && qty > it.onHand) {
      out.push({ name: it.name, need: qty, have: it.onHand, unit: it.unit })
    }
  }
  return out
}

/** Turn form line rows into resolved line inputs, dropping empty rows. */
export function buildLineInputs(
  lines: LineFieldValues[] | undefined,
): SalesDocLineInput[] {
  return (lines ?? [])
    .filter((l) => l?.item && (l.quantity ?? 0) > 0)
    .map((l) => {
      const [kind, id] = (l.item as string).split(':')
      return {
        itemKind: kind as StockItemKind,
        itemId: id,
        quantity: l.quantity as number,
        unitPrice: l.unitPrice ?? 0,
        taxIncluded: !!l.taxIncluded,
        packaging: l.packaging ?? '',
        description: l.description ?? '',
      }
    })
}

/** Details auto-filled onto a line when its item is picked. */
export interface ItemMeta {
  packaging: string
  description: string
  price: number
}

/** Compose a one-line address from a customer's address fields. */
export function formatAddress(c: Customer): string {
  return [c.addressLine1, c.addressLine2, c.city, c.state, c.postalCode, c.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

/**
 * Everything the quotation/invoice forms need in one hook: stock items (for the
 * pickers), a per-item metadata map (packaging/description/default price), the
 * customer list (for autofill), and the sales-applicable taxes.
 */
export function useSalesFormData() {
  const { data: items, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: products } = useGetProductsQuery()
  const { data: materials } = useGetMaterialsQuery()
  const { data: customers } = useGetCustomersQuery()
  const { data: taxes } = useGetTaxesQuery()

  const itemMeta = useMemo(() => {
    const map = new Map<string, ItemMeta>()
    products?.forEach((p) =>
      map.set(`product:${p.id}`, {
        packaging: p.packaging,
        description: '',
        price: p.price,
      }),
    )
    materials?.forEach((m) =>
      map.set(`material:${m.id}`, {
        packaging: m.packaging,
        description: m.description,
        price: m.unitCost,
      }),
    )
    return map
  }, [products, materials])

  return {
    items: items ?? [],
    itemsLoading,
    itemMeta,
    customers: (customers ?? []) as Customer[],
    taxes: (taxes ?? []).filter(isSalesTax) as Tax[],
  }
}
