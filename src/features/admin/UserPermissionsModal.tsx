import { useEffect, useState } from 'react'
import { App, Modal, Segmented } from 'antd'
import { MODULES, type ModuleId } from '../modules/modules'
import { useSetUserPermissionsMutation } from './adminApi'
import type { ModulePermissionEffect, UserPermission } from './rbac/rbacTypes'
import type { User } from '../auth/types'

type Choice = 'inherit' | ModulePermissionEffect

function UserPermissionsModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { message } = App.useApp()
  const [setUserPermissions, { isLoading }] = useSetUserPermissionsMutation()
  const [choices, setChoices] = useState<Record<string, Choice>>({})

  useEffect(() => {
    if (!user) return
    const next: Record<string, Choice> = {}
    for (const m of MODULES) {
      const override = user.userPermissions.find((p) => p.moduleId === m.id)
      next[m.id] = override ? override.effect : 'inherit'
    }
    setChoices(next)
  }, [user])

  const handleOk = async () => {
    if (!user) return
    const userPermissions: UserPermission[] = MODULES.flatMap((m) => {
      const c = choices[m.id]
      return c && c !== 'inherit' ? [{ moduleId: m.id as ModuleId, effect: c }] : []
    })
    try {
      await setUserPermissions({ id: user.id, userPermissions }).unwrap()
      message.success('Overrides saved.')
      onClose()
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not save overrides.')
    }
  }

  return (
    <Modal
      title={user ? `Access overrides — ${user.name}` : 'Access overrides'}
      open={!!user}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={isLoading}
      okText="Save overrides"
      destroyOnClose
    >
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        Per-module overrides on top of this user's roles and position. <strong>Deny</strong> always wins;
        <strong> Inherit</strong> leaves the role/position grant untouched.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {MODULES.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>{m.name}</span>
            <Segmented<Choice>
              size="small"
              value={choices[m.id] ?? 'inherit'}
              onChange={(value) => setChoices((prev) => ({ ...prev, [m.id]: value }))}
              options={[
                { value: 'inherit', label: 'Inherit' },
                { value: 'allow', label: 'Allow' },
                { value: 'deny', label: 'Deny' },
              ]}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default UserPermissionsModal
