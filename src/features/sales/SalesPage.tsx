import { Link } from 'react-router-dom'
import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetSalesQuery } from '../inventory/inventoryApi'
import type { Sale, SaleLine } from '../inventory/types'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const columns: ColumnsType<Sale> = [
  {
    title: 'Reference',
    dataIndex: 'reference',
    render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Date',
    dataIndex: 'date',
    defaultSortOrder: 'descend',
    sorter: (a, b) => a.date.localeCompare(b.date),
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  { title: 'Customer', dataIndex: 'customerName', render: (v: string) => v || '—' },
  {
    title: 'Items',
    align: 'right',
    render: (_, r) => r.lines.reduce((s, l) => s + l.quantity, 0).toLocaleString(),
  },
  {
    title: 'Total',
    dataIndex: 'total',
    align: 'right',
    render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
  },
]

const lineColumns: ColumnsType<SaleLine> = [
  { title: 'Item', dataIndex: 'itemName' },
  { title: 'Kind', dataIndex: 'itemKind', render: (k: string) => (k === 'material' ? 'Material' : 'Product') },
  { title: 'Qty', dataIndex: 'quantity', align: 'right', render: (q: number, r) => `${q} ${r.unit}` },
  { title: 'Unit price', dataIndex: 'unitPrice', align: 'right', render: (v: number) => peso(v) },
  { title: 'Line total', align: 'right', render: (_, r) => peso(r.quantity * r.unitPrice) },
]

function SalesPage() {
  const { data: sales, isLoading } = useGetSalesQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Sales Orders</h1>
          <p>Issue products and materials out of stock (the only way to reduce inventory).</p>
        </div>
        <Link to="/sales/orders/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New sale
          </Button>
        </Link>
      </div>

      <Table<Sale>
        rowKey="id"
        columns={columns}
        dataSource={sales}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No sales yet. Issue stock with your first one.' }}
        expandable={{
          expandedRowRender: (r) => (
            <Table<SaleLine>
              rowKey={(l) => `${l.itemKind}:${l.itemId}`}
              columns={lineColumns}
              dataSource={r.lines}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ),
        }}
      />
    </div>
  )
}

export default SalesPage
