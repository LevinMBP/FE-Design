import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  addPaymentMethod,
  addTax,
  listPaymentMethods,
  listTaxes,
} from './mockFinance'
import type {
  NewPaymentMethod,
  NewTax,
  PaymentMethod,
  Tax,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const financeApi = createApi({
  reducerPath: 'financeApi',
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ['Tax', 'PaymentMethod'],
  endpoints: (builder) => ({
    getTaxes: builder.query<Tax[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listTaxes() }
      },
      providesTags: ['Tax'],
    }),
    addTax: builder.mutation<Tax, NewTax>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addTax(body) }
      },
      invalidatesTags: ['Tax'],
    }),

    getPaymentMethods: builder.query<PaymentMethod[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listPaymentMethods() }
      },
      providesTags: ['PaymentMethod'],
    }),
    addPaymentMethod: builder.mutation<PaymentMethod, NewPaymentMethod>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addPaymentMethod(body) }
      },
      invalidatesTags: ['PaymentMethod'],
    }),
  }),
})

export const {
  useGetTaxesQuery,
  useAddTaxMutation,
  useGetPaymentMethodsQuery,
  useAddPaymentMethodMutation,
} = financeApi
