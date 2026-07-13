import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  addCustomer,
  addEmployee,
  addVendor,
  listCustomers,
  listEmployees,
  listVendors,
} from './mockContacts'
import type {
  Customer,
  Employee,
  NewCustomer,
  NewEmployee,
  NewVendor,
  Vendor,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const contactsApi = createApi({
  reducerPath: 'contactsApi',
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ['Customer', 'Vendor', 'Employee'],
  endpoints: (builder) => ({
    getCustomers: builder.query<Customer[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listCustomers() }
      },
      providesTags: ['Customer'],
    }),
    addCustomer: builder.mutation<Customer, NewCustomer>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addCustomer(body) }
      },
      invalidatesTags: ['Customer'],
    }),

    getVendors: builder.query<Vendor[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listVendors() }
      },
      providesTags: ['Vendor'],
    }),
    addVendor: builder.mutation<Vendor, NewVendor>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addVendor(body) }
      },
      invalidatesTags: ['Vendor'],
    }),

    getEmployees: builder.query<Employee[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listEmployees() }
      },
      providesTags: ['Employee'],
    }),
    addEmployee: builder.mutation<Employee, NewEmployee>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addEmployee(body) }
      },
      invalidatesTags: ['Employee'],
    }),
  }),
})

export const {
  useGetCustomersQuery,
  useAddCustomerMutation,
  useGetVendorsQuery,
  useAddVendorMutation,
  useGetEmployeesQuery,
  useAddEmployeeMutation,
} = contactsApi
