import { useNavigate } from 'react-router-dom'
import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useGetStockItemsQuery } from '../inventoryApi'
import type { StockItem, StockStatus } from '../types'

const STATUS_META: Record<StockStatus, { color: string; label: string }> = {
  ok: { color: 'green', label: 'OK' },
  low: { color: 'gold', label: 'Low' },
  out: { color: 'red', label: 'Out' },
}

const columns: ColumnsType<StockItem> = [
  {
    title: 'Item',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (_: string, item) => (
      <div>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
          {item.sku}
        </div>
      </div>
    ),
  },
  {
    title: 'Type',
    dataIndex: 'kind',
    filters: [
      { text: 'Product', value: 'product' },
      { text: 'Material', value: 'material' },
    ],
    onFilter: (value, item) => item.kind === value,
    render: (kind: StockItem['kind']) => (
      <Tag color={kind === 'product' ? 'blue' : 'default'}>
        {kind === 'product' ? 'Product' : 'Material'}
      </Tag>
    ),
  },
  { title: 'Unit', dataIndex: 'unit' },
  {
    title: 'On hand',
    dataIndex: 'onHand',
    align: 'right',
    sorter: (a, b) => a.onHand - b.onHand,
    render: (v: number) => (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
    ),
  },
  {
    title: 'Avg cost',
    dataIndex: 'avgCost',
    align: 'right',
    render: (v: number) => (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>${v.toFixed(2)}</span>
    ),
  },
  {
    title: 'Stock value',
    dataIndex: 'stockValue',
    align: 'right',
    sorter: (a, b) => a.stockValue - b.stockValue,
    render: (v: number) => (
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    title: 'Stock status',
    dataIndex: 'status',
    align: 'center',
    filters: (Object.keys(STATUS_META) as StockStatus[]).map((s) => ({
      text: STATUS_META[s].label,
      value: s,
    })),
    onFilter: (value, item) => item.status === value,
    render: (status: StockStatus) => (
      <Tag color={STATUS_META[status].color}>{STATUS_META[status].label}</Tag>
    ),
  },
]

function StockOverviewPage() {
  const { data: items, isLoading } = useGetStockItemsQuery()
  const navigate = useNavigate()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Stock Overview</h1>
          <p>On-hand quantities for products and materials.</p>
        </div>
      </div>

      <Table<StockItem>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={isLoading}
        pagination={{ pageSize: 12, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        onRow={(item) => ({
          onClick: () => navigate(`/inventory/stock/${item.kind}/${item.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  )
}

export default StockOverviewPage
