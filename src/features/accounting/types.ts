export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

/** Assets and expenses carry a debit-normal balance; everything else credit. */
export function normalIsDebit(type: AccountType): boolean {
  return type === 'asset' || type === 'expense'
}

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  /** Opening balance on the account's normal side (always ≥ 0). */
  openingBalance: number
}

/** An account plus its computed current balance (opening + postings). */
export interface AccountBalance extends Account {
  debit: number // current balance shown in the debit column (0 if credit)
  credit: number // current balance shown in the credit column (0 if debit)
  natural: number // balance in the account's normal direction (signed)
}

export interface JournalLine {
  accountId: string
  debit: number
  credit: number
}

export interface JournalEntry {
  id: string
  reference: string // JE-0001
  date: string // ISO date
  memo: string
  lines: JournalLine[]
  totalDebit: number
  totalCredit: number
}

export interface NewJournalEntry {
  date: string
  memo: string
  lines: JournalLine[]
}

export interface OpeningBalanceInput {
  accountId: string
  openingBalance: number
}

export interface LedgerRow {
  id: string
  date: string
  reference: string
  memo: string
  debit: number
  credit: number
  /** Running balance in the account's normal direction (signed). */
  balance: number
  opening?: boolean
}

export interface AccountLedger {
  account: Account
  rows: LedgerRow[]
  closingBalance: number
}

export interface TrialBalance {
  rows: AccountBalance[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

export interface ReportLine {
  code: string
  name: string
  amount: number
}

export interface ReportGroup {
  label: string
  lines: ReportLine[]
  total: number
}

export interface BalanceSheet {
  assets: ReportGroup
  liabilities: ReportGroup
  equity: ReportGroup
  netIncome: number
  totalAssets: number
  totalLiabilitiesEquity: number
  balanced: boolean
}

export interface IncomeStatement {
  income: ReportGroup
  expenses: ReportGroup
  netIncome: number
}

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

export function formatPeso(value: number): string {
  return peso.format(value)
}
