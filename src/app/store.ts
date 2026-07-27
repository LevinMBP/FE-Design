import { configureStore } from '@reduxjs/toolkit'
import { authApi } from '../features/auth/authApi'
import { notificationsApi } from '../features/notifications/notificationsApi'
import { inventoryApi } from '../features/inventory/inventoryApi'
import { contactsApi } from '../features/contacts/contactsApi'
import { financeApi } from '../features/finance/financeApi'
import { payrollApi } from '../features/payroll/payrollApi'
import { accountingApi } from '../features/accounting/accountingApi'
import { salesDocsApi } from '../features/sales/salesDocsApi'
import { adminApi } from '../features/admin/adminApi'
import authReducer from '../features/auth/authSlice'
import uiReducer from '../features/ui/uiSlice'
import rbacReducer from '../features/admin/rbac/rbacSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    rbac: rbacReducer,
    [authApi.reducerPath]: authApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
    [financeApi.reducerPath]: financeApi.reducer,
    [payrollApi.reducerPath]: payrollApi.reducer,
    [accountingApi.reducerPath]: accountingApi.reducer,
    [salesDocsApi.reducerPath]: salesDocsApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
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
      adminApi.middleware,
    ),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
