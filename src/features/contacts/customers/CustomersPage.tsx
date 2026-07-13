import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetCustomersQuery } from '../contactsApi'
import type { Customer } from '../types'

const columns: ColumnsType<Customer> = [
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
  const { data: customers, isLoading } = useGetCustomersQuery()

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

      <Table<Customer>
        rowKey="id"
        columns={columns}
        dataSource={customers}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default CustomersPage
