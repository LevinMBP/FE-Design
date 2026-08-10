import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import {
  useDeleteEmployeeMutation,
  useGetEmployeesQuery,
  useRestoreEmployeeMutation,
} from '../contactsApi'
import { DEPARTMENTS, type Employee } from '../types'
import type { ListScope } from '../../../shared/softDelete'
import ScopeFilter from '../../../shared/components/ScopeFilter'
import {
  deletedRowClassName,
  softDeleteColumns,
} from '../../../shared/components/softDeleteColumns'
import { useIsAdmin } from '../../admin/rbac/useIsAdmin'

const baseColumns: ColumnsType<Employee> = [
  {
    title: 'Name',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span>,
  },
  { title: 'Position', dataIndex: 'position' },
  {
    title: 'Department',
    dataIndex: 'department',
    filters: DEPARTMENTS.map((d) => ({ text: d, value: d })),
    onFilter: (value, r) => r.department === value,
    render: (department: string) => <Tag color="blue">{department}</Tag>,
  },
  { title: 'Email', dataIndex: 'email' },
  { title: 'Phone', dataIndex: 'phone' },
  {
    title: 'Status',
    dataIndex: 'status',
    align: 'center',
    filters: [
      { text: 'Active', value: 'active' },
      { text: 'Inactive', value: 'inactive' },
    ],
    onFilter: (value, r) => r.status === value,
    render: (status: Employee['status']) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function EmployeesPage() {
  const { message } = App.useApp()
  const isAdmin = useIsAdmin()
  const [scope, setScope] = useState<ListScope>('active')
  const { data: employees, isFetching } = useGetEmployeesQuery(scope)
  const [deleteEmployee, { isLoading: deleting, originalArgs: deletingId }] =
    useDeleteEmployeeMutation()
  const [restoreEmployee, { isLoading: restoring, originalArgs: restoringId }] =
    useRestoreEmployeeMutation()

  const columns = useMemo<ColumnsType<Employee>>(
    () => [
      ...baseColumns,
      ...softDeleteColumns<Employee>(scope !== 'active', {
        entityLabel: 'employee',
        describe: (r) => r.name,
        canRestore: isAdmin,
        pendingId: deleting ? deletingId : restoring ? restoringId : null,
        onDelete: async (r) => {
          const res = await deleteEmployee(r.id)
          if ('error' in res) message.error(String(res.error))
          else message.success(`${r.name} deleted`)
        },
        onRestore: async (r) => {
          const res = await restoreEmployee(r.id)
          if ('error' in res) message.error(String(res.error))
          else message.success(`${r.name} restored`)
        },
      }),
    ],
    [
      scope,
      isAdmin,
      deleting,
      deletingId,
      restoring,
      restoringId,
      deleteEmployee,
      restoreEmployee,
      message,
    ],
  )

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Employees</h1>
          <p>Your team members.</p>
        </div>
        <Link to="/finance/employees/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New employee
          </Button>
        </Link>
      </div>

      <ScopeFilter value={scope} onChange={setScope} />

      <Table<Employee>
        rowKey="id"
        columns={columns}
        dataSource={employees}
        loading={isFetching}
        rowClassName={deletedRowClassName}
        locale={{ emptyText: scope === 'deleted' ? 'No deleted employees.' : 'No employees yet.' }}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default EmployeesPage
