import {
  applyScope,
  isDeleted,
  markDeleted,
  markRestored,
  type ListScope,
  type SoftDeletable,
} from '../../shared/softDelete'
import { loadSession } from '../auth/session'
import type {
  Customer,
  Employee,
  NewCustomer,
  NewEmployee,
  NewVendor,
  Vendor,
} from './types'

/**
 * In-memory mock contacts "database", mirroring `inventory/mockInventory.ts`.
 * The contactsApi endpoints call these and invalidate RTK Query tags so lists
 * refetch. Replace with real HTTP later without touching the components.
 *
 * Deletes are soft: the row stays and gets a `deletedAt` stamp, so historical
 * documents that reference it keep resolving. Lists take a `ListScope` the same
 * way the real endpoints will take a `scope` query param.
 */

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

/** Who is performing the delete — resolved from the session like `recordAuditEvent` does. */
const actorName = () => loadSession()?.user?.name ?? 'System'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** Thrown for conditions a real API would answer with 4xx; surfaced to the user verbatim. */
class ContactError extends Error {}

type Row = SoftDeletable & { id: string; email: string }

/**
 * Stamp or clear the delete marker on one row, returning a new array.
 *
 * Restore re-checks email uniqueness: while a record sat deleted, someone may
 * have created a live one with the same email. A real backend hits this as a
 * unique-index violation, so the client has to handle it either way.
 */
function setDeleted<T extends Row>(rows: T[], id: string, deleted: boolean, label: string) {
  const target = rows.find((row) => row.id === id)
  if (!target) throw new ContactError(`That ${label} no longer exists.`)
  if (isDeleted(target) === deleted) return { next: rows, record: target }

  if (!deleted && target.email) {
    const clash = rows.some(
      (row) =>
        row.id !== id &&
        !isDeleted(row) &&
        row.email.toLowerCase() === target.email.toLowerCase(),
    )
    if (clash) {
      throw new ContactError(
        `Another ${label} already uses ${target.email}. Change that email before restoring this one.`,
      )
    }
  }

  const record = deleted ? markDeleted(target, actorName()) : markRestored(target)
  return { next: rows.map((row) => (row.id === id ? record : row)), record }
}

let customers: Customer[] = [
  { id: 'cus_acme', company: 'Acme Retail', email: 'alice@acmeretail.com', contactPerson: 'Alice Reyes', contactNumber: '+63 917 555 0101', addressLine1: '12 Ayala Ave', addressLine2: 'Unit 4B', city: 'Makati', state: 'Metro Manila', postalCode: '1226', country: 'Philippines', latitude: 14.5547, longitude: 121.0244, status: 'active' },
  { id: 'cus_north', company: 'Northwind Trading', email: 'ben@northwind.co', contactPerson: 'Ben Cruz', contactNumber: '+63 917 555 0142', addressLine1: '88 Ortigas Center', addressLine2: '', city: 'Pasig', state: 'Metro Manila', postalCode: '1605', country: 'Philippines', latitude: 14.5866, longitude: 121.0614, status: 'active' },
  { id: 'cus_luzon', company: 'Luzon Distributors', email: 'carla@luzondist.ph', contactPerson: 'Carla Santos', contactNumber: '+63 917 555 0177', addressLine1: '5 Session Rd', addressLine2: '', city: 'Baguio', state: 'Benguet', postalCode: '2600', country: 'Philippines', latitude: 16.4108, longitude: 120.5967, status: 'inactive' },
  // Seeded as deleted so the Deleted scope has something in it on first open.
  { id: 'cus_oldco', company: 'OldCo Merchandising', email: 'info@oldco.ph', contactPerson: 'Rita Bautista', contactNumber: '+63 917 555 0190', addressLine1: '19 Rizal Ave', addressLine2: '', city: 'Cebu City', state: 'Cebu', postalCode: '6000', country: 'Philippines', latitude: 10.3157, longitude: 123.8854, status: 'inactive', deletedAt: daysAgo(9), deletedBy: 'Ava Reyes' },
]

let vendors: Vendor[] = [
  { id: 'ven_steelco', company: 'SteelCo Supply', email: 'sales@steelco.ph', contactPerson: 'Diego Lim', contactNumber: '+63 917 555 0210', addressLine1: '210 Quirino Hwy', addressLine2: '', city: 'Caloocan', state: 'Metro Manila', postalCode: '1400', country: 'Philippines', latitude: 14.7566, longitude: 121.0447, status: 'active' },
  { id: 'ven_packright', company: 'PackRight Inc.', email: 'orders@packright.com', contactPerson: 'Ella Tan', contactNumber: '+63 917 555 0234', addressLine1: '34 Industria St', addressLine2: 'Bldg 2', city: 'Valenzuela', state: 'Metro Manila', postalCode: '1440', country: 'Philippines', latitude: 14.7011, longitude: 120.9830, status: 'active' },
  { id: 'ven_movit', company: 'MovIt Logistics', email: 'ops@movit.ph', contactPerson: 'Franco Dela Cruz', contactNumber: '+63 917 555 0288', addressLine1: '7 Export Ave', addressLine2: '', city: 'Parañaque', state: 'Metro Manila', postalCode: '1700', country: 'Philippines', latitude: 14.4793, longitude: 121.0198, status: 'inactive' },
  { id: 'ven_legacy', company: 'Legacy Paper Mills', email: 'contact@legacypaper.ph', contactPerson: 'Hector Yap', contactNumber: '+63 917 555 0299', addressLine1: '3 Mill Rd', addressLine2: '', city: 'Bulacan', state: 'Bulacan', postalCode: '3000', country: 'Philippines', latitude: 14.7943, longitude: 120.8797, status: 'inactive', deletedAt: daysAgo(21), deletedBy: 'Marcus Lee' },
]

let employees: Employee[] = [
  { id: 'emp_gab', name: 'Gabriel Ong', email: 'gabriel@venturo.ph', phone: '+63 917 555 0301', position: 'Warehouse Lead', department: 'Warehouse', status: 'active' },
  { id: 'emp_hana', name: 'Hana Villanueva', email: 'hana@venturo.ph', phone: '+63 917 555 0322', position: 'Account Manager', department: 'Sales', status: 'active' },
  { id: 'emp_ivan', name: 'Ivan Mercado', email: 'ivan@venturo.ph', phone: '+63 917 555 0355', position: 'Procurement Officer', department: 'Procurement', status: 'active' },
]

export function listCustomers(scope: ListScope = 'active'): Customer[] {
  return applyScope(customers, scope)
}
export function addCustomer(input: NewCustomer): Customer {
  const record: Customer = { id: uid('cus'), ...input, deletedAt: null, deletedBy: null }
  customers = [record, ...customers]
  return record
}
export function deleteCustomer(id: string): Customer {
  const { next, record } = setDeleted(customers, id, true, 'customer')
  customers = next
  return record
}
export function restoreCustomer(id: string): Customer {
  const { next, record } = setDeleted(customers, id, false, 'customer')
  customers = next
  return record
}

export function listVendors(scope: ListScope = 'active'): Vendor[] {
  return applyScope(vendors, scope)
}
export function addVendor(input: NewVendor): Vendor {
  const record: Vendor = { id: uid('ven'), ...input, deletedAt: null, deletedBy: null }
  vendors = [record, ...vendors]
  return record
}
export function deleteVendor(id: string): Vendor {
  const { next, record } = setDeleted(vendors, id, true, 'vendor')
  vendors = next
  return record
}
export function restoreVendor(id: string): Vendor {
  const { next, record } = setDeleted(vendors, id, false, 'vendor')
  vendors = next
  return record
}

export function listEmployees(scope: ListScope = 'active'): Employee[] {
  return applyScope(employees, scope)
}
export function addEmployee(input: NewEmployee): Employee {
  const record: Employee = { id: uid('emp'), ...input, deletedAt: null, deletedBy: null }
  employees = [record, ...employees]
  return record
}
export function deleteEmployee(id: string): Employee {
  const { next, record } = setDeleted(employees, id, true, 'employee')
  employees = next
  return record
}
export function restoreEmployee(id: string): Employee {
  const { next, record } = setDeleted(employees, id, false, 'employee')
  employees = next
  return record
}
