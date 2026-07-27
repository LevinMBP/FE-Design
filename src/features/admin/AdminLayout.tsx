import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutGrid,
  Users,
  Building2,
  Building,
  Briefcase,
  ShieldCheck,
  ScrollText,
  FileText,
  ArrowLeft,
} from 'lucide-react'
import BrandMark from '../../shared/components/BrandMark'
import ShellTopbar from '../../layout/ShellTopbar'
import '../../layout/AppShell.css'
import '../../layout/Sidebar.css'
import './admin.css'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/roles', label: 'Roles', icon: ShieldCheck, end: false },
  { to: '/admin/positions', label: 'Positions', icon: Briefcase, end: false },
  { to: '/admin/organizations', label: 'Organizations', icon: Building, end: false },
  { to: '/admin/company', label: 'Company', icon: Building2, end: false },
  { to: '/admin/quotation-layout', label: 'Quotation Layout', icon: FileText, end: false },
  { to: '/admin/audit-log', label: 'Audit Log', icon: ScrollText, end: false },
]

/** Dedicated shell for the admin area: admin sub-nav + shared topbar + content panel. */
function AdminLayout() {
  return (
    <div className="shell">
      <aside className="sidebar admin-sidebar">
        <div className="sidebar__head">
          <Link to="/" className="sidebar__brand" title="Venturo">
            <BrandMark size={26} />
            <span className="sidebar__label">Venturo</span>
          </Link>
        </div>

        <div className="sidebar__module-label">Administration</div>

        <nav className="sidebar__nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
            >
              <Icon size={18} />
              <span className="sidebar__label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__spacer" />

        <Link to="/" className="sidebar__card">
          <span className="sidebar__card-icon">
            <ArrowLeft size={18} />
          </span>
          <span className="sidebar__card-title">Back to app</span>
          <span className="sidebar__card-text">Return to the module launcher.</span>
        </Link>
      </aside>

      <div className="shell__main">
        <ShellTopbar />
        <div className="shell__panel">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
