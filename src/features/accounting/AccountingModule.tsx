import type { ReactNode } from 'react'
import { ListTree, NotebookPen, Scale, TrendingUp } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import SectionCard from '../modules/SectionCard'
import { ACCOUNTING_SECTIONS } from '../modules/plannedSections'
import {
  useGetAccountsQuery,
  useGetIncomeStatementQuery,
  useGetJournalEntriesQuery,
  useGetTrialBalanceQuery,
} from './accountingApi'
import { formatPeso } from './types'
import '../modules/ModulePage.css'

function AccountingModule() {
  const user = useAppSelector(selectUser)
  const firstName = user?.name.split(' ')[0] ?? 'there'

  const { data: accounts } = useGetAccountsQuery()
  const { data: entries } = useGetJournalEntriesQuery()
  const { data: trialBalance } = useGetTrialBalanceQuery()
  const { data: incomeStatement } = useGetIncomeStatementQuery()

  return (
    <div className="module-view">
      <header className="module-page__header">
        <h1>Accounting, {firstName} 👋</h1>
        <p>Journal entries, ledgers and financial statements.</p>
      </header>

      <div className="stat-grid">
        <StatCard
          icon={<ListTree size={20} />}
          label="Accounts"
          value={accounts?.length ?? '—'}
          tone="brand"
        />
        <StatCard
          icon={<NotebookPen size={20} />}
          label="Journal Entries"
          value={entries?.length ?? '—'}
          tone="green"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Net Income"
          value={incomeStatement ? formatPeso(incomeStatement.netIncome) : '—'}
          tone="warn"
        />
        <StatCard
          icon={<Scale size={20} />}
          label="Books"
          value={
            trialBalance ? (trialBalance.balanced ? 'Balanced' : 'Out of balance') : '—'
          }
          tone={trialBalance && !trialBalance.balanced ? 'warn' : 'neutral'}
        />
      </div>

      <h2 className="module-page__section-title">Manage</h2>
      <div className="section-grid">
        {ACCOUNTING_SECTIONS.map((section) => (
          <SectionCard key={section.label} section={section} />
        ))}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone: 'brand' | 'green' | 'warn' | 'neutral'
}) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>{icon}</div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

export default AccountingModule
