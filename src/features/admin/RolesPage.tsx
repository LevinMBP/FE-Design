import { useState } from 'react'
import { Button, Checkbox, Switch, Tag } from 'antd'
import { Plus } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { MODULES, type ModuleId } from '../modules/modules'
import { selectRbac, setRoleAdmin, toggleRoleModule } from './rbac/rbacSlice'
import { recordAuditEvent } from './mockAuditLog'
import AddRoleModal from './AddRoleModal'
import './admin.css'

function RolesPage() {
  const rbac = useAppSelector(selectRbac)
  const dispatch = useAppDispatch()
  const [addOpen, setAddOpen] = useState(false)

  const onToggle = (roleId: string, moduleId: ModuleId, roleName: string, moduleName: string) => {
    dispatch(toggleRoleModule({ roleId, moduleId }))
    recordAuditEvent({ module: 'admin', action: 'Changed role access', target: roleName, details: moduleName })
  }
  const onAdminToggle = (roleId: string, isSystemAdmin: boolean, roleName: string) => {
    dispatch(setRoleAdmin({ roleId, isSystemAdmin }))
    recordAuditEvent({
      module: 'admin',
      action: isSystemAdmin ? 'Granted system admin' : 'Revoked system admin',
      target: roleName,
    })
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Roles</h1>
          <p>Named roles and the modules each one grants. System-admin roles always get everything.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
          Add role
        </Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-matrix">
          <thead>
            <tr>
              <th>Role</th>
              <th>System admin</th>
              {MODULES.map((m) => (
                <th key={m.id}>{m.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rbac.roles.map((role) => (
              <tr key={role.id}>
                <td>
                  {role.name}
                  {role.isSystemAdmin && (
                    <Tag color="geekblue" style={{ marginLeft: 8 }}>
                      Full access
                    </Tag>
                  )}
                  {role.description && <div className="admin-matrix__role-desc">{role.description}</div>}
                </td>
                <td>
                  <Switch
                    checked={role.isSystemAdmin}
                    onChange={(checked) => onAdminToggle(role.id, checked, role.name)}
                  />
                </td>
                {MODULES.map((m) => (
                  <td key={m.id}>
                    <Checkbox
                      checked={role.isSystemAdmin || (rbac.rolePermissions[role.id] ?? []).includes(m.id)}
                      disabled={role.isSystemAdmin}
                      onChange={() => onToggle(role.id, m.id, role.name, m.name)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddRoleModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

export default RolesPage
