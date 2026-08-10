import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import {
  useDeleteVendorMutation,
  useGetVendorsQuery,
  useRestoreVendorMutation,
} from '../contactsApi'
import type { Vendor } from '../types'
import type { ListScope } from '../../../shared/softDelete'
import ScopeFilter from '../../../shared/components/ScopeFilter'
import {
  deletedRowClassName,
  softDeleteColumns,
} from '../../../shared/components/softDeleteColumns'
import { useIsAdmin } from '../../admin/rbac/useIsAdmin'

const baseColumns: ColumnsType<Vendor> = [
  {
    title: 'Company',
    dataIndex: 'company',
    sorter: (a, b) => a.company.localeCompare(b.company),
    render: (company: string, r) => (
      <div>
        <Link to={`/purchases/vendors/${r.id}`} style={{ fontWeight: 600 }}>
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
    render: (_, r) => [r.city, r.country].filter(Boolean).join(', ') || '—',
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
    render: (status: Vendor['status']) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function VendorsPage() {
  const { message } = App.useApp()
  const isAdmin = useIsAdmin()
  const [scope, setScope] = useState<ListScope>('active')
  const { data: vendors, isFetching } = useGetVendorsQuery(scope)
  const [deleteVendor, { isLoading: deleting, originalArgs: deletingId }] =
    useDeleteVendorMutation()
  const [restoreVendor, { isLoading: restoring, originalArgs: restoringId }] =
    useRestoreVendorMutation()

  const columns = useMemo<ColumnsType<Vendor>>(
    () => [
      ...baseColumns,
      ...softDeleteColumns<Vendor>(scope !== 'active', {
        entityLabel: 'vendor',
        describe: (r) => r.company,
        canRestore: isAdmin,
        pendingId: deleting ? deletingId : restoring ? restoringId : null,
        onDelete: async (r) => {
          const res = await deleteVendor(r.id)
          if ('error' in res) message.error(String(res.error))
          else message.success(`${r.company} deleted`)
        },
        onRestore: async (r) => {
          const res = await restoreVendor(r.id)
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
      deleteVendor,
      restoreVendor,
      message,
    ],
  )

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Vendors</h1>
          <p>Suppliers you purchase from.</p>
        </div>
        <Link to="/purchases/vendors/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New vendor
          </Button>
        </Link>
      </div>

      <ScopeFilter value={scope} onChange={setScope} />

      <Table<Vendor>
        rowKey="id"
        columns={columns}
        dataSource={vendors}
        loading={isFetching}
        rowClassName={deletedRowClassName}
        locale={{ emptyText: scope === 'deleted' ? 'No deleted vendors.' : 'No vendors yet.' }}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default VendorsPage
