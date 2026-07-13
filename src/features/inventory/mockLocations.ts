import type { InventoryLocation, NewLocation } from './types'

/**
 * In-memory mock location "database". Locations are master data — the
 * warehouses/stores stock physically sits in, referenced by stock movements
 * and the Opening Balance document. Create + list only (matches other master
 * data). Replace with real HTTP later without touching the components.
 */

const uid = () => `loc_${crypto.randomUUID().slice(0, 8)}`

let locations: InventoryLocation[] = [
  { id: 'loc_main', name: 'Main Warehouse', code: 'WH-MAIN', type: 'warehouse', address: '', description: 'Primary storage.', status: 'active' },
  { id: 'loc_store', name: 'Store Front', code: 'ST-01', type: 'store', address: '', description: 'Retail floor stock.', status: 'active' },
]

export function listLocations(): InventoryLocation[] {
  return [...locations]
}

export function addLocation(input: NewLocation): InventoryLocation {
  const record: InventoryLocation = { id: uid(), ...input }
  locations = [record, ...locations]
  return record
}
