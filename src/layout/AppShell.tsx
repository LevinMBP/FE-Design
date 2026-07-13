import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ShellTopbar from './ShellTopbar'
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
