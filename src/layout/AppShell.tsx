import { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Sidebar, { moduleFromPath } from './Sidebar'
import ShellTopbar from './ShellTopbar'
import { useAppSelector } from '../app/hooks'
import { selectUser } from '../features/auth/authSlice'
import { selectRbac } from '../features/admin/rbac/rbacSlice'
import { allowedModulesForUser } from '../features/admin/rbac/mockRbac'
import './AppShell.css'
// Shared page-level utility styles (.page-head, .btn, .form-*, etc.) used by
// every screen rendered inside the shell — imported once here rather than
// per-page. Global CSS, so it's available to all shell routes.
import '../shared/styles/ui.css'

const COLLAPSE_KEY = 'venturo:sidebar-collapsed'

/** Persistent dashboard shell: left sidebar + top bar + rounded content panel. */
function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const { pathname } = useLocation()
  const user = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)
  const allowedModules = useMemo(
    () => (user ? allowedModulesForUser(rbac, user) : []),
    [rbac, user],
  )

  // Access control: if this path belongs to a module the user can't use, bounce home.
  const moduleId = moduleFromPath(pathname)
  if (moduleId && user && !allowedModules.includes(moduleId)) {
    return <Navigate to="/" replace />
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="shell" data-collapsed={collapsed || undefined}>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="shell__main">
        <ShellTopbar />
        <div className="shell__panel">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AppShell
