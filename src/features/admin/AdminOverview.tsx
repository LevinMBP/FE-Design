import { Link } from 'react-router-dom'
import { Users, Building2, ShieldCheck, ScrollText, Briefcase, FileText } from 'lucide-react'
import { useMemo } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { selectRbac } from './rbac/rbacSlice'
import { roleNamesForUser } from './rbac/mockRbac'
import { useGetUsersQuery, useGetAuditEventsQuery } from './adminApi'
import './admin.css'

const SECTIONS = [
  { to: '/admin/users', icon: Users, title: 'Users & Roles', text: 'Add users, assign roles and positions, activate or deactivate.' },
  { to: '/admin/roles', icon: ShieldCheck, title: 'Roles', text: 'Named roles and which modules each one grants.' },
  { to: '/admin/positions', icon: Briefcase, title: 'Positions', text: 'Job positions and the module access they grant.' },
  { to: '/admin/organizations', icon: Building2, title: 'Organizations', text: 'The tenant your users and roles belong to.' },
  { to: '/admin/company', icon: Building2, title: 'Company', text: 'Business identity, currency and fiscal year.' },
  { to: '/admin/quotation-layout', icon: FileText, title: 'Quotation Layout', text: 'Customize how the quotation document looks.' },
  { to: '/admin/audit-log', icon: ScrollText, title: 'Audit Log', text: 'See who did what, and when, across the app.' },
]

function AdminOverview() {
  const user = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)
  const roleNames = useMemo(() => (user ? roleNamesForUser(rbac, user) : []), [rbac, user])
  const { data: users } = useGetUsersQuery()
  const { data: events } = useGetAuditEventsQuery()

  const activeCount = users?.filter((u) => u.status === 'active').length ?? 0

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p>Manage users, company settings, access and activity.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat__value">{users?.length ?? '—'}</div>
          <div className="admin-stat__label">Users</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__value">{activeCount}</div>
          <div className="admin-stat__label">Active users</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__value" style={{ fontSize: 18 }}>
            {roleNames.join(', ') || '—'}
          </div>
          <div className="admin-stat__label">Your role</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__value">{events?.length ?? '—'}</div>
          <div className="admin-stat__label">Logged events</div>
        </div>
      </div>

      <div className="admin-cards">
        {SECTIONS.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="admin-card">
            <span className="admin-card__icon">
              <Icon size={20} />
            </span>
            <span>
              <span className="admin-card__title">{title}</span>
              <span className="admin-card__text">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default AdminOverview
