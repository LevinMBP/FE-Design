import type { ReactNode } from 'react'
import { Tags, Coins, PackageMinus, ReceiptText } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import SectionCard from '../modules/SectionCard'
import { SALES_SECTIONS } from '../modules/plannedSections'
import { useGetSalesQuery } from '../inventory/inventoryApi'
import { useGetInvoicesQuery } from './salesDocsApi'
import { openReceivables } from './receivables'
import '../modules/ModulePage.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

function SalesModule() {
  const user = useAppSelector(selectUser)
  const firstName = user?.name.split(' ')[0] ?? 'there'

  const { data: sales } = useGetSalesQuery()
  const { data: invoices } = useGetInvoicesQuery()
  const totalRevenue = sales?.reduce((s, x) => s + x.total, 0)
  const itemsSold = sales?.reduce(
    (s, x) => s + x.lines.reduce((n, l) => n + l.quantity, 0),
    0,
  )
  // Outstanding = what's still uncollected across invoices AND sales orders,
  // net of any part payments already allocated to them.
  const outstanding =
    invoices && sales
      ? openReceivables(invoices, sales).reduce((s, r) => s + r.outstanding, 0)
      : undefined

  return (
    <div className="module-view">
      <header className="module-page__header">
        <h1>Sales, {firstName} 👋</h1>
        <p>Issue products and materials out of stock.</p>
      </header>

      <div className="stat-grid">
        <StatCard
          icon={<Tags size={20} />}
          label="Sales"
          value={sales?.length ?? '—'}
          tone="brand"
        />
        <StatCard
          icon={<Coins size={20} />}
          label="Total Revenue"
          value={totalRevenue != null ? peso(totalRevenue) : '—'}
          tone="green"
        />
        <StatCard
          icon={<PackageMinus size={20} />}
          label="Items Sold"
          value={itemsSold != null ? itemsSold.toLocaleString() : '—'}
          tone="warn"
        />
        <StatCard
          icon={<ReceiptText size={20} />}
          label="Outstanding Receivables"
          value={outstanding != null ? peso(outstanding) : '—'}
          tone="neutral"
        />
      </div>

      <h2 className="module-page__section-title">Manage</h2>
      <div className="section-grid">
        {SALES_SECTIONS.map((section) => (
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

export default SalesModule
