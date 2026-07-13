import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetAuditsQuery } from '../inventoryApi'
import type { Audit, AuditStatus } from '../types'

const STATUS_TAG: Record<AuditStatus, { color: string; label: string }> = {
  balanced: { color: 'success', label: 'Balanced' },
  open: { color: 'warning', label: 'Variance' },
  adjusted: { color: 'processing', label: 'Adjusted' },
}

/** Count of lines with a non-zero variance. */
const varianceCount = (a: Audit) =>
  a.lines.filter((l) => Math.abs(l.variance) > 0.0005).length

const columns: ColumnsType<Audit> = [
  {
    title: 'Reference',
    dataIndex: 'reference',
    render: (ref: string, a: Audit) => <Link to={`/inventory/audits/${a.id}`}>{ref}</Link>,
  },
  {
    title: 'Date',
    dataIndex: 'date',
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
  },
  { title: 'Location', dataIndex: 'location', render: (v: string) => v || '—' },
  {
    title: 'Items',
    dataIndex: 'lines',
    align: 'right',
    render: (_: unknown, a: Audit) => a.lines.length,
  },
  {
    title: 'Variances',
    align: 'right',
    render: (_: unknown, a: Audit) => {
      const n = varianceCount(a)
      return n === 0 ? <span style={{ color: 'var(--text-muted)' }}>none</span> : n
    },
  },
  {
    title: 'Status',
    dataIndex: 'status',
    render: (s: AuditStatus, a: Audit) => {
      const t = STATUS_TAG[s]
      return (
        <span>
          <Tag color={t.color}>{t.label}</Tag>
          {s === 'adjusted' && a.adjustmentRef && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.adjustmentRef}</span>
          )}
        </span>
      )
    },
  },
  {
    title: '',
    key: 'action',
    align: 'right',
    render: (_: unknown, a: Audit) =>
      a.status === 'open' ? (
        <Link to={`/inventory/adjustments/new?audit=${a.id}`}>Reconcile</Link>
      ) : (
        <Link to={`/inventory/audits/${a.id}`}>View</Link>
      ),
  },
]

function AuditsPage() {
  const { data: audits, isLoading } = useGetAuditsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Audits</h1>
          <p>
            Physical stock counts. An audit records what you counted against the
            system on-hand — it never changes stock. Reconcile any variance with
            an adjustment.
          </p>
        </div>
        <Link to="/inventory/audits/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New audit
          </Button>
        </Link>
      </div>

      <Table<Audit>
        rowKey="id"
        columns={columns}
        dataSource={audits}
        loading={isLoading}
        pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default AuditsPage
