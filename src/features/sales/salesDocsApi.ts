import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { inventoryApi } from '../inventory/inventoryApi'
import { accountingApi } from '../accounting/accountingApi'
import {
  createInvoice,
  createQuotation,
  getQuotation,
  listInvoices,
  listQuotations,
  markInvoicePaid,
  sendInvoice,
  setQuotationStatus,
} from './mockSalesDocs'
import type {
  Invoice,
  NewInvoice,
  NewQuotation,
  Quotation,
  QuotationStatus,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const fail = (err: unknown, fallback: string) => ({
  error: err instanceof Error ? err.message : fallback,
})

/**
 * Refresh the stock and accounting caches after an invoice is issued: it both
 * deducts stock and auto-posts the revenue + COGS journal entries.
 */
async function refreshStock(
  dispatch: (action: unknown) => unknown,
  queryFulfilled: Promise<unknown>,
) {
  try {
    await queryFulfilled
    dispatch(inventoryApi.util.invalidateTags(['Stock', 'Product', 'Material']))
    dispatch(accountingApi.util.invalidateTags(['JournalEntry', 'Account']))
  } catch {
    // mutation failed — nothing was issued, so nothing to refresh
  }
}

export const salesDocsApi = createApi({
  reducerPath: 'salesDocsApi',
  baseQuery: fakeBaseQuery<string>(),
  // 'Stock' is shared with inventoryApi conceptually, but each API tracks its
  // own tags; issuing an invoice refetches via component-level invalidation.
  tagTypes: ['Quotation', 'Invoice'],
  endpoints: (builder) => ({
    getQuotations: builder.query<Quotation[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listQuotations() }
      },
      providesTags: ['Quotation'],
    }),

    getQuotation: builder.query<Quotation, string>({
      queryFn: async (id) => {
        await delay(200)
        const quote = getQuotation(id)
        return quote ? { data: quote } : { error: 'Quotation not found.' }
      },
      providesTags: (_r, _e, id) => [{ type: 'Quotation' as const, id }],
    }),

    addQuotation: builder.mutation<Quotation, NewQuotation>({
      queryFn: async (body) => {
        await delay(400)
        try {
          return { data: createQuotation(body) }
        } catch (err) {
          return fail(err, 'Could not save quotation.')
        }
      },
      invalidatesTags: ['Quotation'],
    }),

    setQuotationStatus: builder.mutation<
      Quotation,
      { id: string; status: QuotationStatus }
    >({
      queryFn: async ({ id, status }) => {
        await delay(300)
        try {
          return { data: setQuotationStatus(id, status) }
        } catch (err) {
          return fail(err, 'Could not update quotation.')
        }
      },
      invalidatesTags: ['Quotation'],
    }),

    getInvoices: builder.query<Invoice[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listInvoices() }
      },
      providesTags: ['Invoice'],
    }),

    addInvoice: builder.mutation<Invoice, NewInvoice>({
      queryFn: async (body) => {
        await delay(500)
        try {
          return { data: createInvoice(body) }
        } catch (err) {
          return fail(err, 'Could not save invoice.')
        }
      },
      // Converting from a quote flips that quote's status too.
      invalidatesTags: ['Invoice', 'Quotation'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshStock(dispatch, queryFulfilled)
      },
    }),

    sendInvoice: builder.mutation<Invoice, string>({
      queryFn: async (id) => {
        await delay(400)
        try {
          return { data: sendInvoice(id) }
        } catch (err) {
          return fail(err, 'Could not send invoice.')
        }
      },
      invalidatesTags: ['Invoice'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshStock(dispatch, queryFulfilled)
      },
    }),

    markInvoicePaid: builder.mutation<Invoice, string>({
      queryFn: async (id) => {
        await delay(300)
        try {
          return { data: markInvoicePaid(id) }
        } catch (err) {
          return fail(err, 'Could not update invoice.')
        }
      },
      invalidatesTags: ['Invoice'],
    }),
  }),
})

export const {
  useGetQuotationsQuery,
  useGetQuotationQuery,
  useAddQuotationMutation,
  useSetQuotationStatusMutation,
  useGetInvoicesQuery,
  useAddInvoiceMutation,
  useSendInvoiceMutation,
  useMarkInvoicePaidMutation,
} = salesDocsApi
