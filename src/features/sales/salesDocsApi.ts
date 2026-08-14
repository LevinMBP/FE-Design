import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { inventoryApi } from '../inventory/inventoryApi'
import { accountingApi } from '../accounting/accountingApi'
import {
  createInvoice,
  createQuotation,
  getQuotation,
  listInvoices,
  listQuotations,
  sendInvoice,
  setQuotationStatus,
} from './mockSalesDocs'
import {
  listCollections,
  nextCollectionRef,
  recordCollection,
} from './mockCollections'
import { recordAuditEvent } from '../admin/mockAuditLog'
import {
  buildMonthlySalesByInvoice,
  buildMonthlySalesByItem,
  buildSalesByInvoice,
  buildSalesByItem,
} from './salesBreakdown'
import type {
  InvoiceSalesRow,
  ItemSalesRow,
  SalesBreakdownFilter,
  SalesByInvoiceReport,
  SalesByItemReport,
  SalesByMonthReport,
} from './salesBreakdown'
import type {
  Collection,
  Invoice,
  NewCollection,
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

/**
 * Refresh after a collection: it settles sales orders (owned by inventoryApi)
 * as well as invoices, and posts the cash journal entry.
 */
async function refreshSettlement(
  dispatch: (action: unknown) => unknown,
  queryFulfilled: Promise<unknown>,
) {
  try {
    await queryFulfilled
    dispatch(inventoryApi.util.invalidateTags(['Sale']))
    dispatch(accountingApi.util.invalidateTags(['JournalEntry', 'Account']))
  } catch {
    // mutation failed — nothing settled, so nothing to refresh
  }
}

export const salesDocsApi = createApi({
  reducerPath: 'salesDocsApi',
  baseQuery: fakeBaseQuery<string>(),
  // 'Stock' is shared with inventoryApi conceptually, but each API tracks its
  // own tags; issuing an invoice refetches via component-level invalidation.
  tagTypes: ['Quotation', 'Invoice', 'Collection'],
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
          const quotation = createQuotation(body)
          recordAuditEvent({ module: 'sales', action: 'Created quotation', target: quotation.reference })
          return { data: quotation }
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
          const invoice = createInvoice(body)
          recordAuditEvent({ module: 'sales', action: 'Created invoice', target: invoice.reference })
          return { data: invoice }
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

    /** Sales, cost and margin per item across issued invoices in a date range. */
    getSalesByItem: builder.query<SalesByItemReport, SalesBreakdownFilter | void>({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildSalesByItem(filter ?? undefined) }
      },
      providesTags: ['Invoice'],
    }),

    /** The same figures grouped by invoice instead of by item. */
    getSalesByInvoice: builder.query<
      SalesByInvoiceReport,
      SalesBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildSalesByInvoice(filter ?? undefined) }
      },
      providesTags: ['Invoice'],
    }),

    /** The same figures split by month: per-month totals plus running totals. */
    getMonthlySalesByInvoice: builder.query<
      SalesByMonthReport<InvoiceSalesRow>,
      SalesBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlySalesByInvoice(filter ?? undefined) }
      },
      providesTags: ['Invoice'],
    }),

    getMonthlySalesByItem: builder.query<
      SalesByMonthReport<ItemSalesRow>,
      SalesBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlySalesByItem(filter ?? undefined) }
      },
      providesTags: ['Invoice'],
    }),

    getCollections: builder.query<Collection[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listCollections() }
      },
      providesTags: ['Collection'],
    }),

    getNextCollectionRef: builder.query<string, void>({
      queryFn: async () => {
        await delay(50)
        return { data: nextCollectionRef() }
      },
      providesTags: ['Collection'],
    }),

    addCollection: builder.mutation<Collection, NewCollection>({
      queryFn: async (body) => {
        await delay(400)
        try {
          const collection = recordCollection(body)
          recordAuditEvent({
            module: 'sales',
            action: 'Recorded collection',
            target: collection.reference,
            details: `${collection.customerName} — ${collection.allocations.length} document${
              collection.allocations.length === 1 ? '' : 's'
            }`,
          })
          return { data: collection }
        } catch (err) {
          return fail(err, 'Could not record the collection.')
        }
      },
      // Settling receivables updates every allocated invoice and posts a journal.
      invalidatesTags: ['Invoice', 'Collection'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshSettlement(dispatch, queryFulfilled)
      },
    }),
  }),
})

export const {
  useGetQuotationsQuery,
  useGetQuotationQuery,
  useAddQuotationMutation,
  useSetQuotationStatusMutation,
  useGetInvoicesQuery,
  useGetSalesByItemQuery,
  useGetSalesByInvoiceQuery,
  useGetMonthlySalesByInvoiceQuery,
  useGetMonthlySalesByItemQuery,
  useAddInvoiceMutation,
  useSendInvoiceMutation,
  useGetCollectionsQuery,
  useGetNextCollectionRefQuery,
  useAddCollectionMutation,
} = salesDocsApi
