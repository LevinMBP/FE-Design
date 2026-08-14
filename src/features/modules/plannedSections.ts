import type { LucideIcon } from 'lucide-react'
import {
  Package,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  ClipboardCheck,
  SlidersHorizontal,
  PackagePlus,
  Factory,
  ShoppingCart,
  Tags,
  FileText,
  ReceiptText,
  Users,
  Truck,
  UserCog,
  Receipt,
  CreditCard,
  CalendarClock,
  Wallet,
  ListTree,
  PlayCircle,
  NotebookPen,
  BookOpen,
  Scale,
  LayoutList,
  TrendingUp,
  BarChart3,
  Banknote,
  HandCoins,
} from 'lucide-react'

export interface PlannedSection {
  icon: LucideIcon
  label: string
  desc: string
  /** If set, the card links here; otherwise it renders as "coming soon". */
  to?: string
}

export const INVENTORY_SECTIONS: PlannedSection[] = [
  { icon: Package, label: 'Products', desc: 'Imported, local-purchase and manufactured products.', to: '/inventory/products' },
  { icon: Boxes, label: 'Materials', desc: 'Raw materials used to build finished products.', to: '/inventory/materials' },
  { icon: Factory, label: 'Manufacturing', desc: 'Turn materials into finished products.', to: '/inventory/manufacturing' },
  { icon: PackagePlus, label: 'Opening Balances', desc: 'Load existing stock at go-live with FIFO batch costs.', to: '/inventory/opening-balances' },
  { icon: Warehouse, label: 'Locations', desc: 'Warehouses and storage locations.', to: '/inventory/locations' },
  { icon: ArrowLeftRight, label: 'Stock In / Out', desc: 'Track every movement in and out of inventory.', to: '/inventory/stock' },
  { icon: ClipboardCheck, label: 'Audits', desc: 'Count stock and record variances against the system.', to: '/inventory/audits' },
  { icon: SlidersHorizontal, label: 'Adjustments', desc: 'Correct on-hand for recounts, damage, loss or found stock.', to: '/inventory/adjustments' },
]

export const PURCHASES_SECTIONS: PlannedSection[] = [
  { icon: ShoppingCart, label: 'Orders', desc: 'Purchase orders that receive stock in.', to: '/purchases/orders' },
  { icon: Banknote, label: 'Payments', desc: 'Pay vendors and allocate it across their open orders.', to: '/purchases/payments' },
  { icon: Truck, label: 'Vendors', desc: 'Suppliers you purchase from.', to: '/purchases/vendors' },
]

export const SALES_SECTIONS: PlannedSection[] = [
  { icon: FileText, label: 'Quotations', desc: 'Price offers you can convert to invoices.', to: '/sales/quotations' },
  { icon: ReceiptText, label: 'Invoices', desc: 'Bill customers; sending issues stock out.', to: '/sales/invoices' },
  { icon: Tags, label: 'Orders', desc: 'Direct sales orders that issue stock out.', to: '/sales/orders' },
  { icon: HandCoins, label: 'Collections', desc: 'Receive payments and allocate them across open documents.', to: '/sales/collections' },
  { icon: Users, label: 'Customers', desc: 'People and companies you sell to.', to: '/sales/customers' },
  { icon: BarChart3, label: 'Sales Breakdown', desc: 'Revenue, cost and margin by item or invoice.', to: '/sales/reports/breakdown' },
]

export const ACCOUNTING_SECTIONS: PlannedSection[] = [
  { icon: ListTree, label: 'Chart of Accounts', desc: 'All accounts and their balances.', to: '/accounting/accounts' },
  { icon: PlayCircle, label: 'Opening Balances', desc: 'Set each account’s starting balance.', to: '/accounting/opening-balances' },
  { icon: NotebookPen, label: 'Journal Entries', desc: 'Post balanced double-entry transactions.', to: '/accounting/journal' },
  { icon: BookOpen, label: 'General Ledger', desc: 'Per-account postings with running balance.', to: '/accounting/ledger' },
  { icon: Scale, label: 'Trial Balance', desc: 'Debit and credit balance of every account.', to: '/accounting/reports/trial-balance' },
  { icon: LayoutList, label: 'Balance Sheet', desc: 'Assets, liabilities and equity.', to: '/accounting/reports/balance-sheet' },
  { icon: TrendingUp, label: 'Income Statement', desc: 'Revenue less expenses (net income).', to: '/accounting/reports/income-statement' },
]

export const FINANCE_SECTIONS: PlannedSection[] = [
  { icon: Receipt, label: 'Taxes', desc: 'Configure tax rates and rules.', to: '/finance/taxes' },
  { icon: CreditCard, label: 'Payment Methods', desc: 'Ways customers and vendors pay.', to: '/finance/payment-methods' },
  { icon: UserCog, label: 'Employees', desc: 'Your team members.', to: '/finance/employees' },
  { icon: Wallet, label: 'Compensation', desc: 'Set monthly basic pay and allowances per employee.', to: '/payroll/compensation' },
  { icon: CalendarClock, label: 'Pay Runs', desc: 'Generate payroll and payslips for a period.', to: '/payroll/pay-runs' },
]
