import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetAdjustmentsQuery } from '../inventoryApi'
import {
  ADJUSTMENT_REASON_LABELS,
  type Adjustment,
  type AdjustmentLine,
} from '../types'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

/** Signed net value with an up/down colour, e.g. +₱120 in green. */
function NetTag({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <Tag>₱0</Tag>
  return (
    <Tag color={value > 0 ? 'success' : 'error'} style={{ margin: 0 }}>
      {value > 0 ? '+' : '−'}
      {peso(Math.abs(value))}
    </Tag>
  )
}

const lineColumns: ColumnsType<AdjustmentLine> = [
  { title: 'Item', dataIndex: 'itemName' },
  {
    title: 'Before',
    dataIndex: 'previousQty',
    align: 'right',
    render: (v: number, l: AdjustmentLine) => `${v} ${l.unit}`,
  },
  {
    title: 'After',
    dataIndex: 'countedQty',
    align: 'right',
    render: (v: number, l: AdjustmentLine) => `${v} ${l.unit}`,
  },
  {
    title: 'Change',
    dataIndex: 'delta',
    align: 'right',
    render: (v: number) => (
      <Tag color={v > 0 ? 'success' : 'error'} style={{ margin: 0 }}>
        {v > 0 ? `+${v}` : v}
      </Tag>
    ),
  },
  {
    title: 'Unit cost',
    dataIndex: 'unitCost',
    align: 'right',
    render: (v: number) => peso(v),
  },
  {
    title: 'Value',
    dataIndex: 'value',
    align: 'right',
    render: (v: number) => <NetTag value={v} />,
  },
]

const columns: ColumnsType<Adjustment> = [
  { title: 'Reference', dataIndex: 'reference' },
  {
    title: 'Date',
    dataIndex: 'date',
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
  },
  {
    title: 'Type',
    dataIndex: 'itemType',
    render: (t: Adjustment['itemType']) => (t === 'product' ? 'Product' : 'Material'),
  },
  { title: 'Location', dataIndex: 'location', render: (v: string) => v || '—' },
  {
    title: 'Reason',
    dataIndex: 'reason',
    render: (r: Adjustment['reason'], a: Adjustment) => (
      <span>
        {ADJUSTMENT_REASON_LABELS[r]}
        {r === 'other' && a.otherReason && (
          <span style={{ color: 'var(--text-muted)' }}> — {a.otherReason}</span>
        )}
      </span>
    ),
  },
  {
    title: 'Items',
    align: 'right',
    render: (_: unknown, a: Adjustment) => a.lines.length,
  },
  {
    title: 'From audit',
    dataIndex: 'auditRef',
    render: (ref: string | undefined) =>
      ref || <span style={{ color: 'var(--text-muted)' }}>—</span>,
  },
  {
    title: 'Net change',
    dataIndex: 'netValue',
    align: 'right',
    render: (v: number) => <NetTag value={v} />,
  },
]

function AdjustmentsPage() {
  const { data: adjustments, isLoading } = useGetAdjustmentsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Adjustments</h1>
          <p>
            Corrections to on-hand stock — recounts, damage, loss or found stock.
            Each posts a stock movement and books the value to Inventory
            Adjustments.
          </p>
        </div>
        <Link to="/inventory/adjustments/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New adjustment
          </Button>
        </Link>
      </div>

      <Table<Adjustment>
        rowKey="id"
        columns={columns}
        dataSource={adjustments}
        loading={isLoading}
        pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (a) => (
            <div>
              <Table<AdjustmentLine>
                rowKey="itemId"
                columns={lineColumns}
                dataSource={a.lines}
                pagination={false}
                size="small"
              />
              {a.note && (
                <p style={{ margin: '10px 4px 0', color: 'var(--text-muted)' }}>{a.note}</p>
              )}
            </div>
          ),
        }}
      />
    </div>
  )
}

export default AdjustmentsPage
