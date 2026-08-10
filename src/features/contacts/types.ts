import type { SoftDeletable } from '../../shared/softDelete'

/**
 * Whether you currently do business with this contact — a state the user picks.
 * Distinct from deletion (`deletedAt`), which removes the record from lists.
 */
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

export interface Customer extends ContactAddress, SoftDeletable {
  id: string
  company: string
  email: string
  contactPerson: string
  contactNumber: string
  status: ContactStatus
}

export interface Vendor extends ContactAddress, SoftDeletable {
  id: string
  company: string
  email: string
  contactPerson: string
  contactNumber: string
  status: ContactStatus
}

export interface Employee extends SoftDeletable {
  id: string
  name: string
  email: string
  phone: string
  position: string
  department: string
  status: ContactStatus
}

// Delete stamps are set by the server, never submitted from a form.
export type NewCustomer = Omit<Customer, 'id' | keyof SoftDeletable>
export type NewVendor = Omit<Vendor, 'id' | keyof SoftDeletable>
export type NewEmployee = Omit<Employee, 'id' | keyof SoftDeletable>

/** Departments offered in the employee form. */
export const DEPARTMENTS = [
  'Operations',
  'Sales',
  'Finance',
  'Procurement',
  'Warehouse',
  'Administration',
] as const
