import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import {
  useDeleteCustomerMutation,
  useGetCustomersQuery,
  useRestoreCustomerMutation,
} from '../contactsApi'
import type { Customer } from '../types'
import type { ListScope } from '../../../shared/softDelete'
import ScopeFilter from '../../../shared/components/ScopeFilter'
import {
  deletedRowClassName,
  softDeleteColumns,
} from '../../../shared/components/softDeleteColumns'
import { useIsAdmin } from '../../admin/rbac/useIsAdmin'

const baseColumns: ColumnsType<Customer> = [
  {
    title: 'Company',
    dataIndex: 'company',
    sorter: (a, b) => a.company.localeCompare(b.company),
    render: (company: string, r) => (
      <div>
        <Link to={`/sales/customers/${r.id}`} style={{ fontWeight: 600 }}>
          {company}
        </Link>
        {r.contactPerson && (
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
            {r.contactPerson}
          </div>
        )}
      </div>
    ),
  },
  { title: 'Email', dataIndex: 'email', render: (v: string) => v || '—' },
  { title: 'Contact Number', dataIndex: 'contactNumber', render: (v: string) => v || '—' },
  {
    title: 'Location',
    render: (_, r) =>
      [r.city, r.country].filter(Boolean).join(', ') || '—',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    align: 'center',
    filters: [
      { text: 'Active', value: 'active' },
      { text: 'Inactive', value: 'inactive' },
    ],
    onFilter: (value, r) => r.status === value,
    render: (status: Customer['status']) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function CustomersPage() {
  const { message } = App.useApp()
  const isAdmin = useIsAdmin()
  const [scope, setScope] = useState<ListScope>('active')
  const { data: customers, isFetching } = useGetCustomersQuery(scope)
  const [deleteCustomer, { isLoading: deleting, originalArgs: deletingId }] =
    useDeleteCustomerMutation()
  const [restoreCustomer, { isLoading: restoring, originalArgs: restoringId }] =
    useRestoreCustomerMutation()

  const columns = useMemo<ColumnsType<Customer>>(
    () => [
      ...baseColumns,
      ...softDeleteColumns<Customer>(scope !== 'active', {
        entityLabel: 'customer',
        describe: (r) => r.company,
        canRestore: isAdmin,
        pendingId: deleting ? deletingId : restoring ? restoringId : null,
        onDelete: async (r) => {
          const res = await deleteCustomer(r.id)
          if ('error' in res) message.error(String(res.error))
          else message.success(`${r.company} deleted`)
        },
        onRestore: async (r) => {
          const res = await restoreCustomer(r.id)
          if ('error' in res) message.error(String(res.error))
          else message.success(`${r.company} restored`)
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
      deleteCustomer,
      restoreCustomer,
      message,
    ],
  )

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p>People and companies you sell to.</p>
        </div>
        <Link to="/sales/customers/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New customer
          </Button>
        </Link>
      </div>

      <ScopeFilter value={scope} onChange={setScope} />

      <Table<Customer>
        rowKey="id"
        columns={columns}
        dataSource={customers}
        loading={isFetching}
        rowClassName={deletedRowClassName}
        locale={{
          emptyText: scope === 'deleted' ? 'No deleted customers.' : 'No customers yet.',
        }}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default CustomersPage
