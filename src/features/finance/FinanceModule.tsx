import type { ReactNode } from 'react'
import { Receipt, CreditCard, Users, CalendarClock } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import SectionCard from '../modules/SectionCard'
import { FINANCE_SECTIONS } from '../modules/plannedSections'
import { useGetPaymentMethodsQuery, useGetTaxesQuery } from './financeApi'
import {
  useGetCompensationsQuery,
  useGetPayRunsQuery,
} from '../payroll/payrollApi'
import '../modules/ModulePage.css'

function FinanceModule() {
  const user = useAppSelector(selectUser)
  const firstName = user?.name.split(' ')[0] ?? 'there'

  const { data: taxes } = useGetTaxesQuery()
  const { data: paymentMethods } = useGetPaymentMethodsQuery()
  const { data: payRuns } = useGetPayRunsQuery()
  const { data: compensations } = useGetCompensationsQuery()

  return (
    <div className="module-view">
      <header className="module-page__header">
        <h1>Finance &amp; Payroll, {firstName} 👋</h1>
        <p>Taxes, payment methods, employees, compensation and pay runs.</p>
      </header>

      <div className="stat-grid">
        <StatCard
          icon={<Receipt size={20} />}
          label="Taxes"
          value={taxes?.length ?? '—'}
          tone="brand"
        />
        <StatCard
          icon={<CreditCard size={20} />}
          label="Payment Methods"
          value={paymentMethods?.length ?? '—'}
          tone="green"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Employees on Payroll"
          value={compensations?.length ?? '—'}
          tone="neutral"
        />
        <StatCard
          icon={<CalendarClock size={20} />}
          label="Pay Runs"
          value={payRuns?.length ?? '—'}
          tone="neutral"
        />
      </div>

      <h2 className="module-page__section-title">Manage</h2>
      <div className="section-grid">
        {FINANCE_SECTIONS.map((section) => (
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
  tone: 'brand' | 'green' | 'neutral'
}) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>{icon}</div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

export default FinanceModule
