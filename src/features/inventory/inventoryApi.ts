import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { accountingApi } from '../accounting/accountingApi'
import {
  addMaterial,
  addProduct,
  listMaterials,
  listProducts,
} from './mockInventory'
import { getItemLedger, listStockItems } from './mockStockMovements'
import { listManufactureRuns, runManufacture } from './mockManufacturing'
import { createPurchase, listPurchases, nextPurchaseRef } from './mockPurchases'
import { recordVendorPayment, listPayments } from './mockPayments'
import { createSale, listSales } from './mockSales'
import { recordOpeningBalance } from './mockOpeningBalance'
import { addLocation, listLocations } from './mockLocations'
import { createAudit, listAudits } from './mockAudits'
import { createAdjustment, listAdjustments } from './mockAdjustments'
import type {
  Adjustment,
  Audit,
  InventoryLocation,
  ItemLedger,
  ManufactureRequest,
  ManufactureResult,
  ManufactureRun,
  Material,
  NewLocation,
  NewMaterial,
  NewOpeningBalance,
  NewProduct,
  NewAdjustment,
  NewAudit,
  NewPurchase,
  NewSale,
  NewVendorPayment,
  OpeningBalanceResult,
  Payment,
  Product,
  Purchase,
  Sale,
  StockItem,
  StockItemKind,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Refresh the accounting ledger after a transaction auto-posts journal entries. */
async function refreshLedger(
  dispatch: (action: unknown) => unknown,
  queryFulfilled: Promise<unknown>,
) {
  try {
    await queryFulfilled
    dispatch(accountingApi.util.invalidateTags(['JournalEntry', 'Account']))
  } catch {
    // mutation failed — nothing posted, nothing to refresh
  }
}

export const inventoryApi = createApi({
  reducerPath: 'inventoryApi',
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ['Material', 'Product', 'Stock', 'ManufactureRun', 'Purchase', 'Sale', 'Location', 'Payment', 'Audit', 'Adjustment'],
  endpoints: (builder) => ({
    getLocations: builder.query<InventoryLocation[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listLocations() }
      },
      providesTags: ['Location'],
    }),

    addLocation: builder.mutation<InventoryLocation, NewLocation>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addLocation(body) }
      },
      invalidatesTags: ['Location'],
    }),

    getMaterials: builder.query<Material[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listMaterials() }
      },
      providesTags: ['Material'],
    }),

    addMaterial: builder.mutation<Material, NewMaterial>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addMaterial(body) }
      },
      invalidatesTags: ['Material', 'Stock'],
    }),

    getProducts: builder.query<Product[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listProducts() }
      },
      providesTags: ['Product'],
    }),

    addProduct: builder.mutation<Product, NewProduct>({
      queryFn: async (body) => {
        await delay(400)
        return { data: addProduct(body) }
      },
      invalidatesTags: ['Product', 'Stock'],
    }),

    manufacture: builder.mutation<ManufactureResult, ManufactureRequest>({
      queryFn: async (req) => {
        await delay(500)
        try {
          return { data: runManufacture(req) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Manufacturing failed.' }
        }
      },
      // Producing consumes materials, increases product stock, logs a run.
      invalidatesTags: ['Material', 'Product', 'Stock', 'ManufactureRun'],
    }),

    getManufactureRuns: builder.query<ManufactureRun[], void>({
      queryFn: async () => {
        await delay(200)
        return { data: listManufactureRuns() }
      },
      providesTags: ['ManufactureRun'],
    }),

    addOpeningBalance: builder.mutation<OpeningBalanceResult, NewOpeningBalance>({
      queryFn: async (body) => {
        await delay(500)
        try {
          return { data: recordOpeningBalance(body) }
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Could not post opening balance.',
          }
        }
      },
      // Opening stock bumps quantities, appends movements, and posts a journal.
      invalidatesTags: ['Material', 'Product', 'Stock'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshLedger(dispatch, queryFulfilled)
      },
    }),

    getStockItems: builder.query<StockItem[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listStockItems() }
      },
      providesTags: ['Stock'],
    }),

    /**
     * Stock as it stands at one location. `null` means every location combined,
     * which is identical to `getStockItems`. Kept separate so the costing screens
     * that read company-wide figures are never affected by an overview filter.
     */
    getStockItemsAtLocation: builder.query<StockItem[], string | null>({
      queryFn: async (locationId) => {
        await delay(250)
        return { data: listStockItems(locationId ?? undefined) }
      },
      providesTags: ['Stock'],
    }),

    getItemLedger: builder.query<ItemLedger, { kind: StockItemKind; id: string }>({
      queryFn: async ({ kind, id }) => {
        await delay(250)
        const ledger = getItemLedger(kind, id)
        return ledger ? { data: ledger } : { error: 'Item not found.' }
      },
      providesTags: ['Stock'],
    }),

    getPurchases: builder.query<Purchase[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listPurchases() }
      },
      providesTags: ['Purchase'],
    }),

    getNextPurchaseRef: builder.query<string, void>({
      queryFn: async () => {
        await delay(50)
        return { data: nextPurchaseRef() }
      },
      providesTags: ['Purchase'],
    }),

    addPurchase: builder.mutation<Purchase, NewPurchase>({
      queryFn: async (body) => {
        await delay(500)
        try {
          return { data: createPurchase(body) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Purchase failed.' }
        }
      },
      // Receiving stock touches quantities and the ledger.
      invalidatesTags: ['Purchase', 'Material', 'Product', 'Stock'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshLedger(dispatch, queryFulfilled)
      },
    }),

    getPayments: builder.query<Payment[], void>({
      queryFn: async () => {
        await delay(200)
        return { data: listPayments() }
      },
      providesTags: ['Payment'],
    }),

    payPurchase: builder.mutation<Payment, NewVendorPayment>({
      queryFn: async (body) => {
        await delay(400)
        try {
          return { data: recordVendorPayment(body) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Payment failed.' }
        }
      },
      // Settling a payable updates the purchase and posts a journal entry.
      invalidatesTags: ['Purchase', 'Payment'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshLedger(dispatch, queryFulfilled)
      },
    }),

    getSales: builder.query<Sale[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listSales() }
      },
      providesTags: ['Sale'],
    }),

    addSale: builder.mutation<Sale, NewSale>({
      queryFn: async (body) => {
        await delay(500)
        try {
          return { data: createSale(body) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Sale failed.' }
        }
      },
      // Issuing stock touches quantities and the ledger.
      invalidatesTags: ['Sale', 'Material', 'Product', 'Stock'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshLedger(dispatch, queryFulfilled)
      },
    }),

    getAudits: builder.query<Audit[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listAudits() }
      },
      providesTags: ['Audit'],
    }),

    addAudit: builder.mutation<Audit, NewAudit>({
      queryFn: async (body) => {
        await delay(400)
        try {
          return { data: createAudit(body) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Could not save the audit.' }
        }
      },
      // An audit records counts only — it never touches stock or the ledger.
      invalidatesTags: ['Audit'],
    }),

    getAdjustments: builder.query<Adjustment[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listAdjustments() }
      },
      providesTags: ['Adjustment'],
    }),

    addAdjustment: builder.mutation<Adjustment, NewAdjustment>({
      queryFn: async (body) => {
        await delay(500)
        try {
          return { data: createAdjustment(body) }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Adjustment failed.' }
        }
      },
      // Correcting on-hand touches quantities, the ledger, and (if fast-tracked)
      // the source audit's status; it also posts a journal entry.
      invalidatesTags: ['Adjustment', 'Audit', 'Material', 'Product', 'Stock'],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        await refreshLedger(dispatch, queryFulfilled)
      },
    }),
  }),
})

export const {
  useGetMaterialsQuery,
  useAddMaterialMutation,
  useGetProductsQuery,
  useAddProductMutation,
  useAddOpeningBalanceMutation,
  useGetLocationsQuery,
  useAddLocationMutation,
  useManufactureMutation,
  useGetManufactureRunsQuery,
  useGetStockItemsQuery,
  useGetStockItemsAtLocationQuery,
  useGetItemLedgerQuery,
  useGetPurchasesQuery,
  useGetNextPurchaseRefQuery,
  useAddPurchaseMutation,
  useGetPaymentsQuery,
  usePayPurchaseMutation,
  useGetSalesQuery,
  useAddSaleMutation,
  useGetAuditsQuery,
  useAddAuditMutation,
  useGetAdjustmentsQuery,
  useAddAdjustmentMutation,
} = inventoryApi
