import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  addCustomer,
  addEmployee,
  addVendor,
  deleteCustomer,
  deleteEmployee,
  deleteVendor,
  listCustomers,
  listEmployees,
  listVendors,
  restoreCustomer,
  restoreEmployee,
  restoreVendor,
} from './mockContacts'
import { recordAuditEvent } from '../admin/mockAuditLog'
import type { ListScope } from '../../shared/softDelete'
import type {
  Customer,
  Employee,
  NewCustomer,
  NewEmployee,
  NewVendor,
  Vendor,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wrap a mock mutation so a thrown error becomes an RTK Query `error` the page
 * can show, instead of an unhandled rejection. Restore is the case that matters:
 * it can legitimately fail when a live record has taken the same email.
 */
async function run<T>(fn: () => T): Promise<{ data: T } | { error: string }> {
  await delay(400)
  try {
    return { data: fn() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Something went wrong.' }
  }
}

export const contactsApi = createApi({
  reducerPath: 'contactsApi',
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ['Customer', 'Vendor', 'Employee'],
  endpoints: (builder) => ({
    // Lists take a scope; delete and restore invalidate the flat tag so the
    // active, deleted, and all views all refetch rather than going stale.
    getCustomers: builder.query<Customer[], ListScope | void>({
      queryFn: async (scope) => {
        await delay(250)
        return { data: listCustomers(scope || 'active') }
      },
      providesTags: ['Customer'],
    }),
    addCustomer: builder.mutation<Customer, NewCustomer>({
      queryFn: async (body) => {
        await delay(400)
        const customer = addCustomer(body)
        recordAuditEvent({ module: 'sales', action: 'Added customer', target: customer.company })
        return { data: customer }
      },
      invalidatesTags: ['Customer'],
    }),
    deleteCustomer: builder.mutation<Customer, string>({
      queryFn: (id) =>
        run(() => {
          const customer = deleteCustomer(id)
          recordAuditEvent({ module: 'sales', action: 'Deleted customer', target: customer.company })
          return customer
        }),
      invalidatesTags: ['Customer'],
    }),
    restoreCustomer: builder.mutation<Customer, string>({
      queryFn: (id) =>
        run(() => {
          const customer = restoreCustomer(id)
          recordAuditEvent({ module: 'sales', action: 'Restored customer', target: customer.company })
          return customer
        }),
      invalidatesTags: ['Customer'],
    }),

    getVendors: builder.query<Vendor[], ListScope | void>({
      queryFn: async (scope) => {
        await delay(250)
        return { data: listVendors(scope || 'active') }
      },
      providesTags: ['Vendor'],
    }),
    addVendor: builder.mutation<Vendor, NewVendor>({
      queryFn: async (body) => {
        await delay(400)
        const vendor = addVendor(body)
        recordAuditEvent({ module: 'purchases', action: 'Added vendor', target: vendor.company })
        return { data: vendor }
      },
      invalidatesTags: ['Vendor'],
    }),
    deleteVendor: builder.mutation<Vendor, string>({
      queryFn: (id) =>
        run(() => {
          const vendor = deleteVendor(id)
          recordAuditEvent({ module: 'purchases', action: 'Deleted vendor', target: vendor.company })
          return vendor
        }),
      invalidatesTags: ['Vendor'],
    }),
    restoreVendor: builder.mutation<Vendor, string>({
      queryFn: (id) =>
        run(() => {
          const vendor = restoreVendor(id)
          recordAuditEvent({ module: 'purchases', action: 'Restored vendor', target: vendor.company })
          return vendor
        }),
      invalidatesTags: ['Vendor'],
    }),

    getEmployees: builder.query<Employee[], ListScope | void>({
      queryFn: async (scope) => {
        await delay(250)
        return { data: listEmployees(scope || 'active') }
      },
      providesTags: ['Employee'],
    }),
    addEmployee: builder.mutation<Employee, NewEmployee>({
      queryFn: async (body) => {
        await delay(400)
        const employee = addEmployee(body)
        recordAuditEvent({ module: 'payroll', action: 'Added employee', target: employee.name })
        return { data: employee }
      },
      invalidatesTags: ['Employee'],
    }),
    deleteEmployee: builder.mutation<Employee, string>({
      queryFn: (id) =>
        run(() => {
          const employee = deleteEmployee(id)
          recordAuditEvent({ module: 'payroll', action: 'Deleted employee', target: employee.name })
          return employee
        }),
      invalidatesTags: ['Employee'],
    }),
    restoreEmployee: builder.mutation<Employee, string>({
      queryFn: (id) =>
        run(() => {
          const employee = restoreEmployee(id)
          recordAuditEvent({ module: 'payroll', action: 'Restored employee', target: employee.name })
          return employee
        }),
      invalidatesTags: ['Employee'],
    }),
  }),
})

export const {
  useGetCustomersQuery,
  useAddCustomerMutation,
  useDeleteCustomerMutation,
  useRestoreCustomerMutation,
  useGetVendorsQuery,
  useAddVendorMutation,
  useDeleteVendorMutation,
  useRestoreVendorMutation,
  useGetEmployeesQuery,
  useAddEmployeeMutation,
  useDeleteEmployeeMutation,
  useRestoreEmployeeMutation,
} = contactsApi
