import { Navigate, Route, Routes } from 'react-router-dom'
import { useAppSelector } from './hooks'
import RequireAuth from './RequireAuth'
import { useGetSessionQuery } from '../features/auth/authApi'
import { selectIsAuthenticated } from '../features/auth/authSlice'
import { useThemeSync } from '../features/ui/useThemeSync'
import { useCompanyFavicon } from '../features/admin/useCompanyFavicon'
import AppShell from '../layout/AppShell'
import LoginPage from '../features/auth/components/LoginPage'
import VerifyEmailPage from '../features/auth/components/VerifyEmailPage'
import ModuleSelection from '../features/modules/ModuleSelection'
import InventoryModule from '../features/inventory/InventoryModule'
import MaterialsPage from '../features/inventory/materials/MaterialsPage'
import MaterialFormPage from '../features/inventory/materials/MaterialFormPage'
import ProductsPage from '../features/inventory/products/ProductsPage'
import ProductFormPage from '../features/inventory/products/ProductFormPage'
import ProductionLogPage from '../features/inventory/manufacturing/ProductionLogPage'
import ManufactureFormPage from '../features/inventory/manufacturing/ManufactureFormPage'
import RequireAdmin from './RequireAdmin'
import AdminLayout from '../features/admin/AdminLayout'
import AdminOverview from '../features/admin/AdminOverview'
import UsersPage from '../features/admin/UsersPage'
import RolesPage from '../features/admin/RolesPage'
import PositionsPage from '../features/admin/PositionsPage'
import OrganizationsPage from '../features/admin/OrganizationsPage'
import CompanyProfilePage from '../features/admin/CompanyProfilePage'
import QuotationLayoutPage from '../features/admin/QuotationLayoutPage'
import AuditLogPage from '../features/admin/AuditLogPage'
import StockOverviewPage from '../features/inventory/stock/StockOverviewPage'
import ItemLedgerPage from '../features/inventory/stock/ItemLedgerPage'
import OpeningBalancePage from '../features/inventory/opening/OpeningBalancePage'
import LocationsPage from '../features/inventory/locations/LocationsPage'
import LocationFormPage from '../features/inventory/locations/LocationFormPage'
import ItemDetailPage from '../features/inventory/detail/ItemDetailPage'
import AuditsPage from '../features/inventory/audits/AuditsPage'
import AuditFormPage from '../features/inventory/audits/AuditFormPage'
import AuditDetailPage from '../features/inventory/audits/AuditDetailPage'
import AdjustmentsPage from '../features/inventory/adjustments/AdjustmentsPage'
import AdjustmentFormPage from '../features/inventory/adjustments/AdjustmentFormPage'
import CustomerDetailPage from '../features/contacts/customers/CustomerDetailPage'
import VendorDetailPage from '../features/contacts/vendors/VendorDetailPage'
import LocationDetailPage from '../features/inventory/locations/LocationDetailPage'
import PurchasesModule from '../features/purchases/PurchasesModule'
import PurchasesPage from '../features/purchases/PurchasesPage'
import PurchaseFormPage from '../features/purchases/PurchaseFormPage'
import PaymentsPage from '../features/purchases/payments/PaymentsPage'
import PaymentFormPage from '../features/purchases/payments/PaymentFormPage'
import SalesModule from '../features/sales/SalesModule'
import SalesPage from '../features/sales/SalesPage'
import SaleFormPage from '../features/sales/SaleFormPage'
import QuotationsPage from '../features/sales/quotations/QuotationsPage'
import QuotationFormPage from '../features/sales/quotations/QuotationFormPage'
import QuotationDetailPage from '../features/sales/quotations/QuotationDetailPage'
import InvoicesPage from '../features/sales/invoices/InvoicesPage'
import InvoiceFormPage from '../features/sales/invoices/InvoiceFormPage'
import CollectionsPage from '../features/sales/collections/CollectionsPage'
import CollectionFormPage from '../features/sales/collections/CollectionFormPage'
import SalesBreakdownPage from '../features/sales/reports/SalesBreakdownPage'
import CustomersPage from '../features/contacts/customers/CustomersPage'
import CustomerFormPage from '../features/contacts/customers/CustomerFormPage'
import VendorsPage from '../features/contacts/vendors/VendorsPage'
import VendorFormPage from '../features/contacts/vendors/VendorFormPage'
import EmployeesPage from '../features/contacts/employees/EmployeesPage'
import EmployeeFormPage from '../features/contacts/employees/EmployeeFormPage'
import FinanceModule from '../features/finance/FinanceModule'
import TaxesPage from '../features/finance/taxes/TaxesPage'
import TaxFormPage from '../features/finance/taxes/TaxFormPage'
import PaymentMethodsPage from '../features/finance/paymentMethods/PaymentMethodsPage'
import PaymentMethodFormPage from '../features/finance/paymentMethods/PaymentMethodFormPage'
import AccountingModule from '../features/accounting/AccountingModule'
import ChartOfAccountsPage from '../features/accounting/accounts/ChartOfAccountsPage'
import OpeningBalancesPage from '../features/accounting/opening/OpeningBalancesPage'
import JournalEntriesPage from '../features/accounting/journal/JournalEntriesPage'
import JournalEntryFormPage from '../features/accounting/journal/JournalEntryFormPage'
import GeneralLedgerPage from '../features/accounting/ledger/GeneralLedgerPage'
import TrialBalancePage from '../features/accounting/reports/TrialBalancePage'
import BalanceSheetPage from '../features/accounting/reports/BalanceSheetPage'
import IncomeStatementPage from '../features/accounting/reports/IncomeStatementPage'
import SettingsPage from '../features/settings/SettingsPage'
import PayRunsPage from '../features/payroll/payruns/PayRunsPage'
import PayRunFormPage from '../features/payroll/payruns/PayRunFormPage'
import PayRunDetailPage from '../features/payroll/payruns/PayRunDetailPage'
import CompensationPage from '../features/payroll/compensation/CompensationPage'
import CompensationFormPage from '../features/payroll/compensation/CompensationFormPage'
import SplashLoader from '../shared/components/SplashLoader/SplashLoader'

function App() {
  useThemeSync()
  useCompanyFavicon()

  // Fires once on mount to restore any saved session. While it's in flight we
  // show the splash so we never flash the login screen at a signed-in user.
  const { isLoading } = useGetSessionQuery()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  if (isLoading) return <SplashLoader />

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Email confirmation — public, and reachable while signed in or out.
          The token rides in the query string or as the last path segment. */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />

      {/* Module launcher — full-screen, outside the dashboard shell. */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <ModuleSelection />
          </RequireAuth>
        }
      />

      {/* Everything inside a module lives in the dashboard shell. */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/inventory" element={<InventoryModule />} />
        <Route path="/inventory/materials" element={<MaterialsPage />} />
        <Route path="/inventory/materials/new" element={<MaterialFormPage />} />
        <Route path="/inventory/materials/:id" element={<ItemDetailPage kind="material" />} />
        <Route path="/inventory/products" element={<ProductsPage />} />
        <Route path="/inventory/products/new" element={<ProductFormPage />} />
        <Route path="/inventory/products/:id" element={<ItemDetailPage kind="product" />} />
        <Route path="/inventory/stock" element={<StockOverviewPage />} />
        <Route path="/inventory/stock/:kind/:id" element={<ItemLedgerPage />} />
        <Route path="/inventory/opening-balances" element={<OpeningBalancePage />} />
        <Route path="/inventory/locations" element={<LocationsPage />} />
        <Route path="/inventory/locations/new" element={<LocationFormPage />} />
        <Route path="/inventory/locations/:id" element={<LocationDetailPage />} />
        <Route path="/inventory/manufacturing" element={<ProductionLogPage />} />
        <Route path="/inventory/manufacturing/new" element={<ManufactureFormPage />} />
        <Route path="/inventory/audits" element={<AuditsPage />} />
        <Route path="/inventory/audits/new" element={<AuditFormPage />} />
        <Route path="/inventory/audits/:id" element={<AuditDetailPage />} />
        <Route path="/inventory/adjustments" element={<AdjustmentsPage />} />
        <Route path="/inventory/adjustments/new" element={<AdjustmentFormPage />} />
        <Route path="/sales/customers" element={<CustomersPage />} />
        <Route path="/sales/customers/new" element={<CustomerFormPage />} />
        <Route path="/sales/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/purchases/vendors" element={<VendorsPage />} />
        <Route path="/purchases/vendors/new" element={<VendorFormPage />} />
        <Route path="/purchases/vendors/:id" element={<VendorDetailPage />} />
        <Route path="/finance/employees" element={<EmployeesPage />} />
        <Route path="/finance/employees/new" element={<EmployeeFormPage />} />
        {/* Contacts module dissolved — redirect any old links. */}
        <Route path="/contacts" element={<Navigate to="/sales/customers" replace />} />
        <Route path="/contacts/customers" element={<Navigate to="/sales/customers" replace />} />
        <Route path="/contacts/vendors" element={<Navigate to="/purchases/vendors" replace />} />
        <Route path="/contacts/employees" element={<Navigate to="/finance/employees" replace />} />
        <Route path="/finance" element={<FinanceModule />} />
        <Route path="/finance/taxes" element={<TaxesPage />} />
        <Route path="/finance/taxes/new" element={<TaxFormPage />} />
        <Route path="/finance/payment-methods" element={<PaymentMethodsPage />} />
        <Route
          path="/finance/payment-methods/new"
          element={<PaymentMethodFormPage />}
        />
        {/* Payroll merged into Finance — its overview is the Finance module. */}
        <Route path="/payroll" element={<Navigate to="/finance" replace />} />
        <Route path="/payroll/compensation" element={<CompensationPage />} />
        <Route
          path="/payroll/compensation/:employeeId"
          element={<CompensationFormPage />}
        />
        <Route path="/payroll/pay-runs" element={<PayRunsPage />} />
        <Route path="/payroll/pay-runs/new" element={<PayRunFormPage />} />
        <Route path="/payroll/pay-runs/:id" element={<PayRunDetailPage />} />
        <Route path="/purchases" element={<PurchasesModule />} />
        <Route path="/purchases/orders" element={<PurchasesPage />} />
        <Route path="/purchases/orders/new" element={<PurchaseFormPage />} />
        <Route path="/purchases/payments" element={<PaymentsPage />} />
        <Route path="/purchases/payments/new" element={<PaymentFormPage />} />
        <Route path="/sales" element={<SalesModule />} />
        <Route path="/sales/quotations" element={<QuotationsPage />} />
        <Route path="/sales/quotations/new" element={<QuotationFormPage />} />
        <Route path="/sales/quotations/:id" element={<QuotationDetailPage />} />
        <Route path="/sales/invoices" element={<InvoicesPage />} />
        <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
        <Route path="/sales/orders" element={<SalesPage />} />
        <Route path="/sales/orders/new" element={<SaleFormPage />} />
        <Route path="/sales/collections" element={<CollectionsPage />} />
        <Route path="/sales/collections/new" element={<CollectionFormPage />} />
        <Route path="/sales/reports/breakdown" element={<SalesBreakdownPage />} />
        <Route path="/accounting" element={<AccountingModule />} />
        <Route path="/accounting/accounts" element={<ChartOfAccountsPage />} />
        <Route path="/accounting/opening-balances" element={<OpeningBalancesPage />} />
        <Route path="/accounting/journal" element={<JournalEntriesPage />} />
        <Route path="/accounting/journal/new" element={<JournalEntryFormPage />} />
        <Route path="/accounting/ledger" element={<GeneralLedgerPage />} />
        <Route
          path="/accounting/reports/trial-balance"
          element={<TrialBalancePage />}
        />
        <Route
          path="/accounting/reports/balance-sheet"
          element={<BalanceSheetPage />}
        />
        <Route
          path="/accounting/reports/income-statement"
          element={<IncomeStatementPage />}
        />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Admin area — its own shell + sub-nav, gated to the admin role. */}
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/roles" element={<RolesPage />} />
        <Route path="/admin/positions" element={<PositionsPage />} />
        <Route path="/admin/organizations" element={<OrganizationsPage />} />
        <Route path="/admin/company" element={<CompanyProfilePage />} />
        <Route path="/admin/quotation-layout" element={<QuotationLayoutPage />} />
        <Route path="/admin/audit-log" element={<AuditLogPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
