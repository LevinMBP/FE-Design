import { useState } from 'react'
import { App, Button, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { selectRbac } from './rbac/rbacSlice'
import {
  useGetUsersQuery,
  useSetUserRolesMutation,
  useSetUserPositionMutation,
  useSetUserStatusMutation,
} from './adminApi'
import type { User } from '../auth/types'
import AddUserModal from './AddUserModal'
import UserPermissionsModal from './UserPermissionsModal'

function UsersPage() {
  const currentUser = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)
  const { data: users, isLoading } = useGetUsersQuery()
  const [setRoles] = useSetUserRolesMutation()
  const [setPosition] = useSetUserPositionMutation()
  const [setStatus] = useSetUserStatusMutation()
  const { message } = App.useApp()
  const [addOpen, setAddOpen] = useState(false)
  const [overridesFor, setOverridesFor] = useState<User | null>(null)

  const roleOptions = rbac.roles.map((r) => ({ value: r.id, label: r.name }))
  const positionOptions = rbac.positions.map((p) => ({ value: p.id, label: p.name }))

  const onRolesChange = async (id: string, roleIds: string[]) => {
    try {
      await setRoles({ id, roleIds }).unwrap()
      message.success('Roles updated.')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not update roles.')
    }
  }
  const onPositionChange = async (id: string, positionId: string | undefined) => {
    try {
      await setPosition({ id, positionId }).unwrap()
      message.success('Position updated.')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not update position.')
    }
  }
  const onToggleStatus = async (user: User) => {
    const status = user.status === 'active' ? 'inactive' : 'active'
    try {
      await setStatus({ id: user.id, status }).unwrap()
      message.success(status === 'active' ? 'User activated.' : 'User deactivated.')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not update status.')
    }
  }

  const columns: ColumnsType<User> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name: string, u) => (
        <span>
          {name}
          {u.id === currentUser?.id && <Tag style={{ marginLeft: 8 }}>You</Tag>}
        </span>
      ),
    },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Position',
      dataIndex: 'positionId',
      render: (positionId: string | undefined, u) => (
        <Select
          size="small"
          allowClear
          style={{ width: 160 }}
          placeholder="—"
          value={positionId}
          options={positionOptions}
          onChange={(value) => onPositionChange(u.id, value)}
        />
      ),
    },
    {
      title: 'Roles',
      dataIndex: 'roleIds',
      render: (roleIds: string[], u) => (
        <Select
          size="small"
          mode="multiple"
          style={{ minWidth: 180 }}
          placeholder="No roles"
          value={roleIds}
          options={roleOptions}
          onChange={(value) => onRolesChange(u.id, value)}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: User['status']) =>
        status === 'active' ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_: unknown, u) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Button
            size="small"
            icon={<SlidersHorizontal size={14} />}
            onClick={() => setOverridesFor(u)}
          >
            Overrides
          </Button>
          {u.id === currentUser?.id ? (
            <span style={{ color: 'var(--text-subtle)', alignSelf: 'center' }}>—</span>
          ) : (
            <Button size="small" danger={u.status === 'active'} onClick={() => onToggleStatus(u)}>
              {u.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Users &amp; Roles</h1>
          <p>Assign roles and positions, override module access, and manage accounts.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
          Add user
        </Button>
      </div>

      <Table<User>
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No users yet.' }}
      />

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />
      <UserPermissionsModal user={overridesFor} onClose={() => setOverridesFor(null)} />
    </div>
  )
}

export default UsersPage
