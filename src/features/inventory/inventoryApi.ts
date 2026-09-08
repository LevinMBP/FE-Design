import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { accountingApi } from '../accounting/accountingApi'
import {
  addMaterial,
  addProduct,
  listMaterials,
  listProducts,
} from './mockInventory'
import { getItemLedger, listStockItems } from './mockStockMovements'
import { listManufactureRuns, runManufacture, runManufactureBatch } from './mockManufacturing'
import { createPurchase, listPurchases, nextPurchaseRef } from './mockPurchases'
import {
  buildMonthlyPurchasesByItem,
  buildMonthlyPurchasesByOrder,
  buildMonthlyPurchasesByVendor,
  buildPurchasesByItem,
  buildPurchasesByOrder,
  buildPurchasesByVendor,
} from './purchaseBreakdown'
import {
  buildMonthlyStockByItem,
  buildMonthlyStockByLocation,
  buildMonthlyStockBySource,
  buildStockByItem,
  buildStockByLocation,
  buildStockBySource,
} from './stockBreakdown'
import { listPayments, nextPaymentRef, recordVendorPayment } from './mockPayments'
import { createSale, listSales } from './mockSales'
import { recordOpeningBalance } from './mockOpeningBalance'
import { addLocation, listLocations } from './mockLocations'
import { createAudit, listAudits } from './mockAudits'
import { createAdjustment, listAdjustments } from './mockAdjustments'
import { recordAuditEvent } from '../admin/mockAuditLog'
import type {
  ItemStockRow,
  LocationStockRow,
  SourceStockRow,
  StockBreakdownFilter,
  StockByItemReport,
  StockByLocationReport,
  StockByMonthReport,
  StockBySourceReport,
} from './stockBreakdown'
import type {
  ItemPurchaseRow,
  OrderPurchaseRow,
  PurchaseBreakdownFilter,
  PurchasesByItemReport,
  PurchasesByMonthReport,
  PurchasesByOrderReport,
  PurchasesByVendorReport,
  VendorPurchaseRow,
} from './purchaseBreakdown'
import type {
  Adjustment,
  Audit,
  InventoryLocation,
  ItemLedger,
  ManufactureBatchRequest,
  ManufactureBatchResult,
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
        const location = addLocation(body)
        recordAuditEvent({ module: 'inventory', action: 'Added location', target: location.name })
        return { data: location }
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
        const material = addMaterial(body)
        recordAuditEvent({ module: 'inventory', action: 'Added material', target: material.name })
        return { data: material }
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
        const product = addProduct(body)
        recordAuditEvent({ module: 'inventory', action: 'Added product', target: product.name })
        return { data: product }
      },
      invalidatesTags: ['Product', 'Stock'],
    }),

    manufacture: builder.mutation<ManufactureResult, ManufactureRequest>({
      queryFn: async (req) => {
        await delay(500)
        try {
          const result = runManufacture(req)
          recordAuditEvent({
            module: 'inventory',
            action: 'Manufactured product',
            target: result.run.reference,
            details: `${result.run.outputQuantity} × ${result.run.productName}`,
          })
          return { data: result }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Manufacturing failed.' }
        }
      },
      // Producing consumes materials, increases product stock, logs a run.
      invalidatesTags: ['Material', 'Product', 'Stock', 'ManufactureRun'],
    }),

    manufactureBatch: builder.mutation<ManufactureBatchResult, ManufactureBatchRequest>({
      queryFn: async (req) => {
        await delay(500)
        try {
          const result = runManufactureBatch(req)
          recordAuditEvent({
            module: 'inventory',
            action: 'Manufactured products',
            target: result.reference,
            details: `${result.runs.length} product${result.runs.length === 1 ? '' : 's'}`,
          })
          return { data: result }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Manufacturing failed.' }
        }
      },
      // A bulk run consumes materials, increases product stock, logs each run.
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
          const result = recordOpeningBalance(body)
          recordAuditEvent({
            module: 'inventory',
            action: 'Recorded opening balance',
            details: `${result.itemsPosted} item${result.itemsPosted === 1 ? '' : 's'}`,
          })
          return { data: result }
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

    /**
     * Stock movement breakdown — the roll-forward (opening + in − out =
     * closing) per item, per source or per location. All six views read the
     * same period split; only the pivot differs.
     */
    getStockByItem: builder.query<StockByItemReport, StockBreakdownFilter | void>({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildStockByItem(filter ?? undefined) }
      },
      providesTags: ['Stock'],
    }),

    getStockBySource: builder.query<
      StockBySourceReport,
      StockBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildStockBySource(filter ?? undefined) }
      },
      providesTags: ['Stock'],
    }),

    getStockByLocation: builder.query<
      StockByLocationReport,
      StockBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildStockByLocation(filter ?? undefined) }
      },
      providesTags: ['Stock'],
    }),

    /** The same figures split by month: each month opening where the last closed. */
    getMonthlyStockByItem: builder.query<
      StockByMonthReport<ItemStockRow>,
      StockBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlyStockByItem(filter ?? undefined) }
      },
      providesTags: ['Stock'],
    }),

    getMonthlyStockBySource: builder.query<
      StockByMonthReport<SourceStockRow>,
      StockBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlyStockBySource(filter ?? undefined) }
      },
      providesTags: ['Stock'],
    }),

    getMonthlyStockByLocation: builder.query<
      StockByMonthReport<LocationStockRow>,
      StockBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlyStockByLocation(filter ?? undefined) }
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
          const purchase = createPurchase(body)
          recordAuditEvent({ module: 'purchases', action: 'Created purchase', target: purchase.reference })
          return { data: purchase }
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

    /**
     * Purchase breakdown — spend per item, per order or per vendor over a
     * period. All six views read the same cells; only the pivot differs.
     */
    getPurchasesByItem: builder.query<
      PurchasesByItemReport,
      PurchaseBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildPurchasesByItem(filter ?? undefined) }
      },
      providesTags: ['Purchase'],
    }),

    getPurchasesByOrder: builder.query<
      PurchasesByOrderReport,
      PurchaseBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildPurchasesByOrder(filter ?? undefined) }
      },
      providesTags: ['Purchase'],
    }),

    getPurchasesByVendor: builder.query<
      PurchasesByVendorReport,
      PurchaseBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildPurchasesByVendor(filter ?? undefined) }
      },
      providesTags: ['Purchase'],
    }),

    /** The same figures split by month: per-month totals plus running totals. */
    getMonthlyPurchasesByItem: builder.query<
      PurchasesByMonthReport<ItemPurchaseRow>,
      PurchaseBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlyPurchasesByItem(filter ?? undefined) }
      },
      providesTags: ['Purchase'],
    }),

    getMonthlyPurchasesByOrder: builder.query<
      PurchasesByMonthReport<OrderPurchaseRow>,
      PurchaseBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlyPurchasesByOrder(filter ?? undefined) }
      },
      providesTags: ['Purchase'],
    }),

    getMonthlyPurchasesByVendor: builder.query<
      PurchasesByMonthReport<VendorPurchaseRow>,
      PurchaseBreakdownFilter | void
    >({
      queryFn: async (filter) => {
        await delay(250)
        return { data: buildMonthlyPurchasesByVendor(filter ?? undefined) }
      },
      providesTags: ['Purchase'],
    }),

    getPayments: builder.query<Payment[], void>({
      queryFn: async () => {
        await delay(200)
        return { data: listPayments() }
      },
      providesTags: ['Payment'],
    }),

    getNextPaymentRef: builder.query<string, void>({
      queryFn: async () => {
        await delay(50)
        return { data: nextPaymentRef() }
      },
      providesTags: ['Payment'],
    }),

    addVendorPayment: builder.mutation<Payment, NewVendorPayment>({
      queryFn: async (body) => {
        await delay(400)
        try {
          const payment = recordVendorPayment(body)
          recordAuditEvent({
            module: 'purchases',
            action: 'Recorded vendor payment',
            target: payment.reference,
            details: `${payment.vendorName} — ${payment.allocations.length} order${
              payment.allocations.length === 1 ? '' : 's'
            }`,
          })
          return { data: payment }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Payment failed.' }
        }
      },
      // Settling payables updates every allocated purchase and posts a journal.
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
          const sale = createSale(body)
          recordAuditEvent({ module: 'sales', action: 'Created sale', target: sale.reference })
          return { data: sale }
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
          const audit = createAudit(body)
          recordAuditEvent({ module: 'inventory', action: 'Recorded stock audit', target: audit.reference })
          return { data: audit }
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
          const adjustment = createAdjustment(body)
          recordAuditEvent({ module: 'inventory', action: 'Posted stock adjustment', target: adjustment.reference })
          return { data: adjustment }
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
  useManufactureBatchMutation,
  useGetManufactureRunsQuery,
  useGetStockItemsQuery,
  useGetStockItemsAtLocationQuery,
  useGetItemLedgerQuery,
  useGetStockByItemQuery,
  useGetStockBySourceQuery,
  useGetStockByLocationQuery,
  useGetMonthlyStockByItemQuery,
  useGetMonthlyStockBySourceQuery,
  useGetMonthlyStockByLocationQuery,
  useGetPurchasesQuery,
  useGetNextPurchaseRefQuery,
  useAddPurchaseMutation,
  useGetPurchasesByItemQuery,
  useGetPurchasesByOrderQuery,
  useGetPurchasesByVendorQuery,
  useGetMonthlyPurchasesByItemQuery,
  useGetMonthlyPurchasesByOrderQuery,
  useGetMonthlyPurchasesByVendorQuery,
  useGetPaymentsQuery,
  useGetNextPaymentRefQuery,
  useAddVendorPaymentMutation,
  useGetSalesQuery,
  useAddSaleMutation,
  useGetAuditsQuery,
  useAddAuditMutation,
  useGetAdjustmentsQuery,
  useAddAdjustmentMutation,
} = inventoryApi
