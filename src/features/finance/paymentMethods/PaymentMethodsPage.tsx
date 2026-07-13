import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetPaymentMethodsQuery } from '../financeApi'
import {
  PAYMENT_METHOD_TYPES,
  paymentMethodTypeLabel,
  type PaymentMethod,
} from '../types'

const columns: ColumnsType<PaymentMethod> = [
  {
    title: 'Name',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string, r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{name}</div>
        {r.description && (
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
            {r.description}
          </div>
        )}
      </div>
    ),
  },
  {
    title: 'Type',
    dataIndex: 'type',
    filters: PAYMENT_METHOD_TYPES.map((t) => ({ text: t.label, value: t.value })),
    onFilter: (value, r) => r.type === value,
    render: (type: PaymentMethod['type']) => (
      <Tag>{paymentMethodTypeLabel(type)}</Tag>
    ),
  },
  { title: 'Provider', dataIndex: 'provider', render: (v: string) => v || '—' },
  { title: 'Account No.', dataIndex: 'accountNumber', render: (v: string) => v || '—' },
  {
    title: 'Status',
    dataIndex: 'status',
    align: 'center',
    filters: [
      { text: 'Active', value: 'active' },
      { text: 'Inactive', value: 'inactive' },
    ],
    onFilter: (value, r) => r.status === value,
    render: (status: PaymentMethod['status']) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function PaymentMethodsPage() {
  const { data: methods, isLoading } = useGetPaymentMethodsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Payment Methods</h1>
          <p>Ways customers and vendors pay.</p>
        </div>
        <Link to="/finance/payment-methods/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New payment method
          </Button>
        </Link>
      </div>

      <Table<PaymentMethod>
        rowKey="id"
        columns={columns}
        dataSource={methods}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default PaymentMethodsPage
