import {
  normalIsDebit,
  type Account,
  type AccountBalance,
  type AccountLedger,
  type BalanceSheet,
  type IncomeStatement,
  type JournalEntry,
  type JournalLine,
  type LedgerRow,
  type NewJournalEntry,
  type OpeningBalanceInput,
  type ReportGroup,
  type TrialBalance,
} from './types'

/**
 * In-memory mock accounting "database" — a small manual double-entry ledger.
 * Balances are derived (never stored): an account's balance is its opening
 * balance plus the debits/credits of every posted journal line. The reports
 * (trial balance, balance sheet, income statement) are all computed from that,
 * so they always reconcile. Replace with real HTTP later without touching the
 * components. Resets on full reload.
 */

const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad4 = (n: number) => String(n).padStart(4, '0')

let accounts: Account[] = [
  { id: 'acc_cash', code: '1000', name: 'Cash', type: 'asset', openingBalance: 50000 },
  { id: 'acc_bank', code: '1010', name: 'Cash in Bank', type: 'asset', openingBalance: 0 },
  { id: 'acc_ar', code: '1100', name: 'Accounts Receivable', type: 'asset', openingBalance: 20000 },
  { id: 'acc_inv', code: '1200', name: 'Inventory', type: 'asset', openingBalance: 30000 },
  { id: 'acc_vat_in', code: '1300', name: 'Input Tax Receivable', type: 'asset', openingBalance: 0 },
  { id: 'acc_wht_recv', code: '1310', name: 'Creditable Withholding Tax', type: 'asset', openingBalance: 0 },
  { id: 'acc_ppe', code: '1500', name: 'Property & Equipment', type: 'asset', openingBalance: 0 },
  { id: 'acc_ap', code: '2000', name: 'Accounts Payable', type: 'liability', openingBalance: 25000 },
  { id: 'acc_accr', code: '2100', name: 'Accrued Expenses', type: 'liability', openingBalance: 0 },
  { id: 'acc_wht', code: '2110', name: 'Withholding Tax Payable', type: 'liability', openingBalance: 0 },
  { id: 'acc_vat_out', code: '2200', name: 'Output Tax Payable', type: 'liability', openingBalance: 0 },
  { id: 'acc_cap', code: '3000', name: "Owner's Capital", type: 'equity', openingBalance: 75000 },
  { id: 'acc_obe', code: '3900', name: 'Opening Balance Equity', type: 'equity', openingBalance: 0 },
  { id: 'acc_sales', code: '4000', name: 'Sales Revenue', type: 'income', openingBalance: 0 },
  { id: 'acc_cogs', code: '5000', name: 'Cost of Goods Sold', type: 'expense', openingBalance: 0 },
  { id: 'acc_opex', code: '5100', name: 'Operating Expenses', type: 'expense', openingBalance: 0 },
  { id: 'acc_adj', code: '5200', name: 'Inventory Adjustments', type: 'expense', openingBalance: 0 },
]

let jeNo = 0
const line = (accountId: string, debit: number, credit: number): JournalLine => ({
  accountId,
  debit,
  credit,
})

function makeEntry(date: string, memo: string, lines: JournalLine[]): JournalEntry {
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0))
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0))
  return { id: uid('je'), reference: `JE-${pad4(++jeNo)}`, date, memo, lines, totalDebit, totalCredit }
}

// Seeded chronologically (JE-0001 first), then stored newest-first for display.
let journalEntries: JournalEntry[] = [
  makeEntry('2026-07-02', 'Sale on account', [line('acc_ar', 15000, 0), line('acc_sales', 0, 15000)]),
  makeEntry('2026-07-03', 'Cost of goods sold', [line('acc_cogs', 9000, 0), line('acc_inv', 0, 9000)]),
  makeEntry('2026-07-05', 'Paid operating expenses', [line('acc_opex', 4000, 0), line('acc_cash', 0, 4000)]),
].reverse()

/** Running balance of an account in debit-positive terms (debit − credit). */
function debitTermsOf(account: Account): number {
  let dt = normalIsDebit(account.type) ? account.openingBalance : -account.openingBalance
  for (const je of journalEntries) {
    for (const l of je.lines) {
      if (l.accountId === account.id) dt += l.debit - l.credit
    }
  }
  return round2(dt)
}

function toBalance(account: Account): AccountBalance {
  const dt = debitTermsOf(account)
  return {
    ...account,
    debit: dt > 0 ? dt : 0,
    credit: dt < 0 ? -dt : 0,
    natural: round2(normalIsDebit(account.type) ? dt : -dt),
  }
}

export function listAccounts(): Account[] {
  return [...accounts]
}

export function listAccountBalances(): AccountBalance[] {
  return accounts.map(toBalance)
}

export function saveOpeningBalances(items: OpeningBalanceInput[]): Account[] {
  accounts = accounts.map((a) => {
    const found = items.find((i) => i.accountId === a.id)
    return found ? { ...a, openingBalance: Math.max(0, found.openingBalance) } : a
  })
  return [...accounts]
}

export function listJournalEntries(): JournalEntry[] {
  return [...journalEntries]
}

export function addJournalEntry(
  input: NewJournalEntry,
): JournalEntry | { error: string } {
  const lines = input.lines.filter(
    (l) => l.accountId && (l.debit > 0 || l.credit > 0),
  )
  if (lines.length < 2) {
    return { error: 'A journal entry needs at least two lines.' }
  }
  if (lines.some((l) => l.debit > 0 && l.credit > 0)) {
    return { error: 'Each line is either a debit or a credit, not both.' }
  }
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0))
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0))
  if (totalDebit === 0) {
    return { error: 'Amounts must be greater than zero.' }
  }
  if (Math.abs(totalDebit - totalCredit) >= 0.005) {
    return {
      error: `Entry is out of balance — debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}.`,
    }
  }
  const record: JournalEntry = {
    id: uid('je'),
    reference: `JE-${pad4(++jeNo)}`,
    date: input.date,
    memo: input.memo.trim(),
    lines,
    totalDebit,
    totalCredit,
  }
  journalEntries = [record, ...journalEntries]
  return record
}

export function getAccountLedger(accountId: string): AccountLedger | null {
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return null
  const debitNormal = normalIsDebit(account.type)
  const natural = (dt: number) => round2(debitNormal ? dt : -dt)

  let runningDt = debitNormal ? account.openingBalance : -account.openingBalance
  const rows: LedgerRow[] = [
    {
      id: `${account.id}-open`,
      date: '',
      reference: 'Opening Balance',
      memo: '',
      debit: debitNormal ? account.openingBalance : 0,
      credit: debitNormal ? 0 : account.openingBalance,
      balance: natural(runningDt),
      opening: true,
    },
  ]

  const chronological = [...journalEntries].sort((a, b) =>
    a.date === b.date
      ? a.reference.localeCompare(b.reference)
      : a.date.localeCompare(b.date),
  )
  for (const je of chronological) {
    for (const l of je.lines) {
      if (l.accountId !== accountId) continue
      runningDt += l.debit - l.credit
      rows.push({
        id: `${je.id}-${l.accountId}-${l.debit}-${l.credit}`,
        date: je.date,
        reference: je.reference,
        memo: je.memo,
        debit: l.debit,
        credit: l.credit,
        balance: natural(runningDt),
      })
    }
  }

  return { account, rows, closingBalance: natural(runningDt) }
}

function group(label: string, balances: AccountBalance[]): ReportGroup {
  const lines = balances.map((b) => ({ code: b.code, name: b.name, amount: b.natural }))
  return { label, lines, total: round2(lines.reduce((s, l) => s + l.amount, 0)) }
}

export function getTrialBalance(): TrialBalance {
  const rows = listAccountBalances()
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0))
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0))
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 }
}

export function getIncomeStatement(): IncomeStatement {
  const balances = listAccountBalances()
  const income = group('Revenue', balances.filter((b) => b.type === 'income'))
  const expenses = group('Expenses', balances.filter((b) => b.type === 'expense'))
  return { income, expenses, netIncome: round2(income.total - expenses.total) }
}

export function getBalanceSheet(): BalanceSheet {
  const balances = listAccountBalances()
  const assets = group('Assets', balances.filter((b) => b.type === 'asset'))
  const liabilities = group('Liabilities', balances.filter((b) => b.type === 'liability'))
  const equity = group('Equity', balances.filter((b) => b.type === 'equity'))
  const netIncome = getIncomeStatement().netIncome
  const totalAssets = assets.total
  const totalLiabilitiesEquity = round2(liabilities.total + equity.total + netIncome)
  return {
    assets,
    liabilities,
    equity,
    netIncome,
    totalAssets,
    totalLiabilitiesEquity,
    balanced: Math.abs(totalAssets - totalLiabilitiesEquity) < 0.005,
  }
}
