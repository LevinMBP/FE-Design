import { configureStore } from '@reduxjs/toolkit'
import { authApi } from '../features/auth/authApi'
import { notificationsApi } from '../features/notifications/notificationsApi'
import { inventoryApi } from '../features/inventory/inventoryApi'
import { contactsApi } from '../features/contacts/contactsApi'
import { financeApi } from '../features/finance/financeApi'
import { payrollApi } from '../features/payroll/payrollApi'
import { accountingApi } from '../features/accounting/accountingApi'
import { salesDocsApi } from '../features/sales/salesDocsApi'
import authReducer from '../features/auth/authSlice'
import uiReducer from '../features/ui/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    [authApi.reducerPath]: authApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
    [financeApi.reducerPath]: financeApi.reducer,
    [payrollApi.reducerPath]: payrollApi.reducer,
    [accountingApi.reducerPath]: accountingApi.reducer,
    [salesDocsApi.reducerPath]: salesDocsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      notificationsApi.middleware,
      inventoryApi.middleware,
      contactsApi.middleware,
      financeApi.middleware,
      payrollApi.middleware,
      accountingApi.middleware,
      salesDocsApi.middleware,
    ),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
