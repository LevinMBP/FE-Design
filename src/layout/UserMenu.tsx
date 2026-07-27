import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown, type MenuProps } from 'antd'
import {
  User as UserIcon,
  Bell,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { selectUser } from '../features/auth/authSlice'
import { selectRbac } from '../features/admin/rbac/rbacSlice'
import { isAdminUser, roleNamesForUser } from '../features/admin/rbac/mockRbac'
import { useLogoutMutation } from '../features/auth/authApi'
import { useGetNotificationsQuery } from '../features/notifications/notificationsApi'
import { selectTheme, setTheme } from '../features/ui/uiSlice'
import type { ThemePreference } from '../features/ui/theme'
import './UserMenu.css'

const themeOptions: { value: ThemePreference; icon: ReactNode; label: string }[] =
  [
    { value: 'light', icon: <Sun size={15} />, label: 'Light' },
    { value: 'dark', icon: <Moon size={15} />, label: 'Dark' },
    { value: 'system', icon: <Monitor size={15} />, label: 'System' },
  ]

function UserMenu() {
  const user = useAppSelector(selectUser)
  const theme = useAppSelector(selectTheme)
  const rbac = useAppSelector(selectRbac)
  const isAdmin = useMemo(() => (user ? isAdminUser(rbac, user) : false), [rbac, user])
  const roleNames = useMemo(() => (user ? roleNamesForUser(rbac, user) : []), [rbac, user])
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()
  const { data: notifications } = useGetNotificationsQuery()
  const [open, setOpen] = useState(false)

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0

  if (!user) return null

  const items: MenuProps['items'] = [
    {
      key: 'header',
      type: 'group',
      label: (
        <div className="menu__profile">
          <span className="user-menu__avatar user-menu__avatar--lg">
            {initials(user.name)}
          </span>
          <div className="menu__profile-text">
            <span className="menu__profile-name">{user.name}</span>
            <span className="menu__profile-email">{user.email}</span>
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'profile', icon: <UserIcon size={17} />, label: 'Profile' },
    {
      key: 'notifications',
      icon: <Bell size={17} />,
      label: (
        <span className="menu__item-label">
          Notifications
          {unreadCount > 0 && <span className="menu__badge">{unreadCount}</span>}
        </span>
      ),
    },
    { key: 'settings', icon: <Settings size={17} />, label: 'Settings' },
    ...(isAdmin
      ? [{ key: 'admin', icon: <Shield size={17} />, label: 'Admin' }]
      : []),
    { type: 'divider' },
    {
      key: 'theme',
      // Rendered as a group (not a menu item) so it gets no hover/focus
      // motion; its own buttons handle clicks and stop propagation so
      // selecting a theme doesn't close the dropdown.
      type: 'group',
      className: 'menu__theme-item',
      label: (
        <div
          className="menu__theme"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="menu__theme-label">Theme</span>
          <div className="seg" role="group" aria-label="Theme">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`seg__btn ${theme === opt.value ? 'is-active' : ''}`}
                onClick={() => dispatch(setTheme(opt.value))}
                aria-pressed={theme === opt.value}
                aria-label={opt.label}
                title={opt.label}
              >
                {opt.icon}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'signout',
      icon: <LogOut size={17} />,
      label: 'Sign out',
      danger: true,
    },
  ]

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'signout') logout()
    else if (key === 'admin') navigate('/admin')
    else if (key === 'settings' || key === 'profile') navigate('/settings')
    setOpen(false)
  }

  return (
    <div className="user-menu">
      <Dropdown
        menu={{ items, onClick: onMenuClick }}
        trigger={['click']}
        placement="bottomRight"
        open={open}
        onOpenChange={setOpen}
        rootClassName="user-menu__dropdown"
      >
        <button
          type="button"
          className={`user-menu__trigger ${open ? 'is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="user-menu__avatar">
            {initials(user.name)}
            {unreadCount > 0 && (
              <span
                className="user-menu__dot"
                aria-label={`${unreadCount} unread notifications`}
              />
            )}
          </span>
          <span className="user-menu__meta">
            <span className="user-menu__name">{user.name}</span>
            <span className="user-menu__role">{roleNames.join(', ') || 'No role'}</span>
          </span>
          <ChevronDown size={16} className="user-menu__chevron" />
        </button>
      </Dropdown>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default UserMenu
