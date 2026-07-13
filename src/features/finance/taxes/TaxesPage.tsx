import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetTaxesQuery } from '../financeApi'
import { taxAppliesToLabel, type Tax } from '../types'

const columns: ColumnsType<Tax> = [
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
    title: 'Rate',
    dataIndex: 'rate',
    align: 'right',
    sorter: (a, b) => a.rate - b.rate,
    render: (rate: number) => `${rate}%`,
  },
  {
    title: 'Computation',
    dataIndex: 'computation',
    render: (c: Tax['computation']) =>
      c === 'inclusive' ? 'Inclusive' : 'Exclusive',
  },
  {
    title: 'Applies To',
    dataIndex: 'appliesTo',
    filters: [
      { text: 'Sales', value: 'sales' },
      { text: 'Purchases', value: 'purchases' },
      { text: 'Sales & Purchases', value: 'both' },
    ],
    onFilter: (value, r) => r.appliesTo === value,
    render: (v: Tax['appliesTo']) => taxAppliesToLabel(v),
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
    render: (status: Tax['status']) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function TaxesPage() {
  const { data: taxes, isLoading } = useGetTaxesQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Taxes</h1>
          <p>Configure tax rates and rules.</p>
        </div>
        <Link to="/finance/taxes/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New tax
          </Button>
        </Link>
      </div>

      <Table<Tax>
        rowKey="id"
        columns={columns}
        dataSource={taxes}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default TaxesPage
