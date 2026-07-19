export type ContactStatus = 'active' | 'inactive'

/** Shared address + geo details for customers and vendors. */
export interface ContactAddress {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  latitude: number
  longitude: number
}

export interface Customer extends ContactAddress {
  id: string
  company: string
  email: string
  contactPerson: string
  contactNumber: string
  status: ContactStatus
}

export interface Vendor extends ContactAddress {
  id: string
  company: string
  email: string
  contactPerson: string
  contactNumber: string
  status: ContactStatus
}

export interface Employee {
  id: string
  name: string
  email: string
  phone: string
  position: string
  department: string
  status: ContactStatus
}

export type NewCustomer = Omit<Customer, 'id'>
export type NewVendor = Omit<Vendor, 'id'>
export type NewEmployee = Omit<Employee, 'id'>

/** Departments offered in the employee form. */
export const DEPARTMENTS = [
  'Operations',
  'Sales',
  'Finance',
  'Procurement',
  'Warehouse',
  'Administration',
] as const
