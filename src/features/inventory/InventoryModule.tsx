import type { ReactNode } from 'react'
import { PackageCheck, AlertTriangle, Truck } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import SectionCard from '../modules/SectionCard'
import { INVENTORY_SECTIONS } from '../modules/plannedSections'
import '../modules/ModulePage.css'

function InventoryModule() {
  const user = useAppSelector(selectUser)
  const firstName = user?.name.split(' ')[0] ?? 'there'

  return (
    <div className="module-view">
      <header className="module-page__header">
        <h1>Welcome back, {firstName} 👋</h1>
        <p>Here's a snapshot of your inventory.</p>
      </header>

      <div className="stat-grid">
        <StatCard
          icon={<PackageCheck size={20} />}
          label="SKUs in stock"
          value="12,480"
          tone="brand"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Low-stock alerts"
          value="37"
          tone="warn"
        />
        <StatCard
          icon={<Truck size={20} />}
          label="Open purchase orders"
          value="8"
          tone="neutral"
        />
      </div>

      <h2 className="module-page__section-title">Manage</h2>
      <div className="section-grid">
        {INVENTORY_SECTIONS.map((section) => (
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
  value: string
  tone: 'brand' | 'warn' | 'neutral'
}) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>{icon}</div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

export default InventoryModule
