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
 */

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

let customers: Customer[] = [
  { id: 'cus_acme', company: 'Acme Retail', email: 'alice@acmeretail.com', contactPerson: 'Alice Reyes', contactNumber: '+63 917 555 0101', addressLine1: '12 Ayala Ave', addressLine2: 'Unit 4B', city: 'Makati', state: 'Metro Manila', postalCode: '1226', country: 'Philippines', latitude: 14.5547, longitude: 121.0244, status: 'active' },
  { id: 'cus_north', company: 'Northwind Trading', email: 'ben@northwind.co', contactPerson: 'Ben Cruz', contactNumber: '+63 917 555 0142', addressLine1: '88 Ortigas Center', addressLine2: '', city: 'Pasig', state: 'Metro Manila', postalCode: '1605', country: 'Philippines', latitude: 14.5866, longitude: 121.0614, status: 'active' },
  { id: 'cus_luzon', company: 'Luzon Distributors', email: 'carla@luzondist.ph', contactPerson: 'Carla Santos', contactNumber: '+63 917 555 0177', addressLine1: '5 Session Rd', addressLine2: '', city: 'Baguio', state: 'Benguet', postalCode: '2600', country: 'Philippines', latitude: 16.4108, longitude: 120.5967, status: 'inactive' },
]

let vendors: Vendor[] = [
  { id: 'ven_steelco', company: 'SteelCo Supply', email: 'sales@steelco.ph', contactPerson: 'Diego Lim', contactNumber: '+63 917 555 0210', category: 'Raw Materials', addressLine1: '210 Quirino Hwy', addressLine2: '', city: 'Caloocan', state: 'Metro Manila', postalCode: '1400', country: 'Philippines', latitude: 14.7566, longitude: 121.0447, status: 'active' },
  { id: 'ven_packright', company: 'PackRight Inc.', email: 'orders@packright.com', contactPerson: 'Ella Tan', contactNumber: '+63 917 555 0234', category: 'Packaging', addressLine1: '34 Industria St', addressLine2: 'Bldg 2', city: 'Valenzuela', state: 'Metro Manila', postalCode: '1440', country: 'Philippines', latitude: 14.7011, longitude: 120.9830, status: 'active' },
  { id: 'ven_movit', company: 'MovIt Logistics', email: 'ops@movit.ph', contactPerson: 'Franco Dela Cruz', contactNumber: '+63 917 555 0288', category: 'Logistics', addressLine1: '7 Export Ave', addressLine2: '', city: 'Parañaque', state: 'Metro Manila', postalCode: '1700', country: 'Philippines', latitude: 14.4793, longitude: 121.0198, status: 'inactive' },
]

let employees: Employee[] = [
  { id: 'emp_gab', name: 'Gabriel Ong', email: 'gabriel@venturo.ph', phone: '+63 917 555 0301', position: 'Warehouse Lead', department: 'Warehouse', status: 'active' },
  { id: 'emp_hana', name: 'Hana Villanueva', email: 'hana@venturo.ph', phone: '+63 917 555 0322', position: 'Account Manager', department: 'Sales', status: 'active' },
  { id: 'emp_ivan', name: 'Ivan Mercado', email: 'ivan@venturo.ph', phone: '+63 917 555 0355', position: 'Procurement Officer', department: 'Procurement', status: 'active' },
]

export function listCustomers(): Customer[] {
  return [...customers]
}
export function addCustomer(input: NewCustomer): Customer {
  const record: Customer = { id: uid('cus'), ...input }
  customers = [record, ...customers]
  return record
}

export function listVendors(): Vendor[] {
  return [...vendors]
}
export function addVendor(input: NewVendor): Vendor {
  const record: Vendor = { id: uid('ven'), ...input }
  vendors = [record, ...vendors]
  return record
}

export function listEmployees(): Employee[] {
  return [...employees]
}
export function addEmployee(input: NewEmployee): Employee {
  const record: Employee = { id: uid('emp'), ...input }
  employees = [record, ...employees]
  return record
}
