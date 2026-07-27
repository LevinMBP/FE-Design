import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Tooltip } from 'antd'
import { LayoutGrid, Grip, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import BrandMark from '../shared/components/BrandMark'
import { MODULES, type ModuleId } from '../features/modules/modules'
import {
  ACCOUNTING_SECTIONS,
  FINANCE_SECTIONS,
  INVENTORY_SECTIONS,
  PURCHASES_SECTIONS,
  SALES_SECTIONS,
  type PlannedSection,
} from '../features/modules/plannedSections'
import './Sidebar.css'

const SECTIONS: Record<ModuleId, PlannedSection[]> = {
  inventory: INVENTORY_SECTIONS,
  finance: FINANCE_SECTIONS,
  purchases: PURCHASES_SECTIONS,
  sales: SALES_SECTIONS,
  accounting: ACCOUNTING_SECTIONS,
}

const MODULE_SEGMENTS = new Set<string>([
  'inventory',
  'finance',
  'purchases',
  'sales',
  'accounting',
])

export function moduleFromPath(pathname: string): ModuleId | null {
  const seg = pathname.split('/')[1]
  // Payroll lives inside the merged Finance & Payroll module.
  if (seg === 'payroll') return 'finance'
  return MODULE_SEGMENTS.has(seg) ? (seg as ModuleId) : null
}

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

/** Wraps a nav item in a hover tooltip showing its label while collapsed. */
function CollapsibleItem({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean
  label: string
  children: ReactNode
}) {
  if (!collapsed) return <>{children}</>
  return (
    <Tooltip title={label} placement="right" mouseEnterDelay={0}>
      {children}
    </Tooltip>
  )
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation()
  const moduleId = moduleFromPath(pathname)
  const mod = moduleId ? MODULES.find((m) => m.id === moduleId) ?? null : null
  const sections = moduleId ? SECTIONS[moduleId] : []

  return (
    <aside className="sidebar" data-collapsed={collapsed || undefined}>
      <div className="sidebar__head">
        <Link to="/" className="sidebar__brand" title="Venturo">
          <BrandMark size={26} />
          <span className="sidebar__label">Venturo</span>
        </Link>
        <Tooltip
          title={collapsed ? 'Expand' : 'Collapse'}
          placement="right"
          mouseEnterDelay={0}
        >
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </Tooltip>
      </div>

      {mod && !collapsed && (
        <div className="sidebar__module-label">{mod.name}</div>
      )}

      <nav className="sidebar__nav">
        {mod && (
          <CollapsibleItem collapsed={collapsed} label="Overview">
            <NavLink
              to={`/${mod.id}`}
              end
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'is-active' : ''}`
              }
            >
              <LayoutGrid size={18} />
              <span className="sidebar__label">Overview</span>
            </NavLink>
          </CollapsibleItem>
        )}

        {sections.map((section) => {
          const Icon = section.icon
          if (section.to) {
            return (
              <CollapsibleItem
                key={section.label}
                collapsed={collapsed}
                label={section.label}
              >
                <NavLink
                  to={section.to}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? 'is-active' : ''}`
                  }
                >
                  <Icon size={18} />
                  <span className="sidebar__label">{section.label}</span>
                </NavLink>
              </CollapsibleItem>
            )
          }
          return (
            <CollapsibleItem
              key={section.label}
              collapsed={collapsed}
              label={`${section.label} (Soon)`}
            >
              <span className="sidebar__link sidebar__link--disabled">
                <Icon size={18} />
                <span className="sidebar__label">{section.label}</span>
                <span className="sidebar__soon">Soon</span>
              </span>
            </CollapsibleItem>
          )
        })}
      </nav>

      <div className="sidebar__spacer" />

      <CollapsibleItem collapsed={collapsed} label="All modules">
        <Link to="/" className="sidebar__card">
          <span className="sidebar__card-icon">
            <Grip size={18} />
          </span>
          <span className="sidebar__card-title">All modules</span>
          <span className="sidebar__card-text">
            Switch between Inventory, Sales, Purchases and more.
          </span>
        </Link>
      </CollapsibleItem>
    </aside>
  )
}

export default Sidebar
