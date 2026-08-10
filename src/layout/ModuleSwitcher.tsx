import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown, Tooltip, type MenuProps } from 'antd'
import { Check, ChevronsUpDown, Grip } from 'lucide-react'
import { useAppSelector } from '../app/hooks'
import { selectUser } from '../features/auth/authSlice'
import { selectRbac } from '../features/admin/rbac/rbacSlice'
import { allowedModulesForUser } from '../features/admin/rbac/mockRbac'
import { MODULES, type ModuleMeta } from '../features/modules/modules'
import '../shared/styles/accents.css'
import './ModuleSwitcher.css'

/** Menu key for the "All modules" escape hatch back to the launcher screen. */
const ALL_MODULES_KEY = '__all__'

/**
 * Module switcher that sits at the top of the sidebar, where the current
 * module's name used to be printed as static text.
 *
 * Switching modules previously meant a round trip through the launcher at `/`.
 * This keeps that trip available (the last menu item) but makes the common case
 * — jump straight to another module — one click from wherever you are.
 *
 * Only modules the user can actually open are listed, using the same
 * `allowedModulesForUser` check the shell uses to gate routes.
 */
function ModuleSwitcher({
  collapsed,
  current,
}: {
  collapsed: boolean
  current: ModuleMeta | null
}) {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)

  const visibleModules = useMemo(() => {
    const allowed = user ? allowedModulesForUser(rbac, user) : []
    return MODULES.filter((m) => allowed.includes(m.id))
  }, [rbac, user])

  const items = useMemo<MenuProps['items']>(() => {
    const moduleItems = visibleModules.map((mod) => {
      const Icon = mod.icon
      return {
        key: mod.id,
        label: (
          <span className="modswitch__item">
            <span className="accent-chip modswitch__item-icon" data-accent={mod.accent}>
              <Icon size={15} />
            </span>
            <span className="modswitch__item-name">{mod.name}</span>
            {mod.id === current?.id && (
              <Check size={15} className="modswitch__item-check" aria-hidden />
            )}
          </span>
        ),
      }
    })

    return [
      ...moduleItems,
      { type: 'divider' as const },
      {
        key: ALL_MODULES_KEY,
        label: (
          <span className="modswitch__item">
            <span className="modswitch__item-icon modswitch__item-icon--plain">
              <Grip size={15} />
            </span>
            <span className="modswitch__item-name">All modules</span>
          </span>
        ),
      },
    ]
  }, [visibleModules, current])

  const onClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key === ALL_MODULES_KEY ? '/' : `/${key}`)
  }

  const Icon = current?.icon ?? Grip
  const name = current?.name ?? 'All modules'

  const trigger = (
    <button
      type="button"
      className="modswitch__trigger"
      aria-label={`Current module: ${name}. Switch module`}
    >
      <span
        className="accent-chip modswitch__trigger-icon"
        data-accent={current?.accent ?? 'brand'}
      >
        <Icon size={13} />
      </span>
      <span className="modswitch__trigger-text">
        <span className="modswitch__trigger-kicker">Module</span>
        <span className="modswitch__trigger-name">{name}</span>
      </span>
      <ChevronsUpDown size={14} className="modswitch__trigger-chevron" aria-hidden />
    </button>
  )

  return (
    <div className="modswitch">
      <Dropdown
        menu={{ items, onClick, selectedKeys: current ? [current.id] : [] }}
        trigger={['click']}
        placement="bottomLeft"
        classNames={{ root: 'modswitch__menu' }}
      >
        {collapsed ? (
          <Tooltip title={`${name} — switch module`} placement="right" mouseEnterDelay={0}>
            {trigger}
          </Tooltip>
        ) : (
          trigger
        )}
      </Dropdown>
    </div>
  )
}

export default ModuleSwitcher
