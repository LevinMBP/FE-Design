import type { ReactNode } from 'react'
import { ShoppingCart, Coins, PackagePlus, Banknote } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import SectionCard from '../modules/SectionCard'
import { PURCHASES_SECTIONS } from '../modules/plannedSections'
import { useGetPurchasesQuery } from '../inventory/inventoryApi'
import { purchaseOutstanding } from '../inventory/types'
import '../modules/ModulePage.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

function PurchasesModule() {
  const user = useAppSelector(selectUser)
  const firstName = user?.name.split(' ')[0] ?? 'there'

  const { data: purchases } = useGetPurchasesQuery()
  const totalSpend = purchases?.reduce((s, p) => s + p.total, 0)
  const itemsReceived = purchases?.reduce(
    (s, p) => s + p.lines.reduce((n, l) => n + l.quantity, 0),
    0,
  )
  // What vendors are still owed across every open purchase order.
  const payable = purchases?.reduce((s, p) => s + purchaseOutstanding(p), 0)

  return (
    <div className="module-view">
      <header className="module-page__header">
        <h1>Purchases, {firstName} 👋</h1>
        <p>Receive products and materials into stock.</p>
      </header>

      <div className="stat-grid">
        <StatCard
          icon={<ShoppingCart size={20} />}
          label="Purchases"
          value={purchases?.length ?? '—'}
          tone="brand"
        />
        <StatCard
          icon={<Coins size={20} />}
          label="Total Spend"
          value={totalSpend != null ? peso(totalSpend) : '—'}
          tone="warn"
        />
        <StatCard
          icon={<PackagePlus size={20} />}
          label="Items Received"
          value={itemsReceived != null ? itemsReceived.toLocaleString() : '—'}
          tone="green"
        />
        <StatCard
          icon={<Banknote size={20} />}
          label="Outstanding Payables"
          value={payable != null ? peso(payable) : '—'}
          tone="neutral"
        />
      </div>

      <h2 className="module-page__section-title">Manage</h2>
      <div className="section-grid">
        {PURCHASES_SECTIONS.map((section) => (
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

export default PurchasesModule
