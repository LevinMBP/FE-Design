import type { InventoryLocation, NewLocation } from './types'

/**
 * In-memory mock location "database". Locations are master data — the
 * warehouses/stores stock physically sits in, referenced by stock movements
 * and the Opening Balance document. Create + list only (matches other master
 * data). Replace with real HTTP later without touching the components.
 */

const uid = () => `loc_${crypto.randomUUID().slice(0, 8)}`

// prettier-ignore
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

/** Where stock lands when a movement doesn't say — see `resolveLocationId`. */
export const DEFAULT_LOCATION_ID = 'loc_main'

/**
 * Resolve a movement's free-text `location` to a location id.
 *
 * Movements store a *display name*, and the writers disagree on how to spell it:
 * some hardcode 'MAIN WAREHOUSE', others pass `location.name` ('Main Warehouse'),
 * and seeded opening balances carry a placeholder '—'. Matching is therefore
 * case-insensitive on both name and code, and anything unresolved (including the
 * placeholder) falls back to the default location — otherwise a large slice of
 * on-hand would belong to no location at all and per-location totals would
 * under-report. Once movements carry a real location id this collapses to a lookup.
 */
export function resolveLocationId(location: string): string {
  const needle = location.trim().toLowerCase()
  const hit = locations.find(
    (l) => l.name.toLowerCase() === needle || l.code.toLowerCase() === needle,
  )
  return hit?.id ?? DEFAULT_LOCATION_ID
}
