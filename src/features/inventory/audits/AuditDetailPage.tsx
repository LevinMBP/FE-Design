import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Descriptions, Skeleton, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SlidersHorizontal } from 'lucide-react'
import { useGetAuditsQuery } from '../inventoryApi'
import type { Audit, AuditLine, AuditStatus } from '../types'
import './audits.css'

const STATUS_TAG: Record<AuditStatus, { color: string; label: string }> = {
  balanced: { color: 'success', label: 'Balanced' },
  open: { color: 'warning', label: 'Variance' },
  adjusted: { color: 'processing', label: 'Adjusted' },
}

const columns: ColumnsType<AuditLine> = [
  { title: 'Item', dataIndex: 'itemName' },
  {
    title: 'Type',
    dataIndex: 'kind',
    render: (k: AuditLine['kind']) => (k === 'material' ? 'Material' : 'Product'),
  },
  {
    title: 'System',
    dataIndex: 'systemQty',
    align: 'right',
    render: (v: number, l: AuditLine) => `${v} ${l.unit}`,
  },
  {
    title: 'Counted',
    dataIndex: 'countedQty',
    align: 'right',
    render: (v: number, l: AuditLine) => `${v} ${l.unit}`,
  },
  {
    title: 'Variance',
    dataIndex: 'variance',
    align: 'right',
    render: (v: number) => {
      if (Math.abs(v) < 0.0005) return <span style={{ color: 'var(--text-muted)' }}>—</span>
      return (
        <Tag color={v > 0 ? 'success' : 'error'} style={{ margin: 0 }}>
          {v > 0 ? `+${v}` : v}
        </Tag>
      )
    },
  },
]

function AuditDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: audits, isLoading } = useGetAuditsQuery()
  const audit: Audit | undefined = audits?.find((a) => a.id === id)

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="module-view">
        <div className="page-head">
          <h1>Audit not found</h1>
        </div>
        <Link to="/inventory/audits">← Back to audits</Link>
      </div>
    )
  }

  const status = STATUS_TAG[audit.status]
  const variances = audit.lines.filter((l) => Math.abs(l.variance) > 0.0005)

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>
            {audit.reference} <Tag color={status.color}>{status.label}</Tag>
          </h1>
          <p>Stock count — recorded, not yet applied to inventory unless adjusted.</p>
        </div>
        {audit.status === 'open' && (
          <Button
            type="primary"
            icon={<SlidersHorizontal size={16} />}
            onClick={() => navigate(`/inventory/adjustments/new?audit=${audit.id}`)}
          >
            Create adjustment
          </Button>
        )}
      </div>

      {audit.status === 'open' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${variances.length} item(s) don't match the system count.`}
          description="Nothing has changed in inventory yet. Fast-track an adjustment to reconcile these variances — it pre-fills the counted quantities for you."
        />
      )}
      {audit.status === 'adjusted' && audit.adjustmentRef && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Reconciled by adjustment ${audit.adjustmentRef}.`}
          description={<Link to="/inventory/adjustments">View adjustments →</Link>}
        />
      )}
      {audit.status === 'balanced' && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Every counted quantity matched the system. Nothing to adjust."
        />
      )}

      <Descriptions
        column={{ xs: 1, sm: 2, md: 3 }}
        size="small"
        style={{ marginBottom: 16 }}
        items={[
          { key: 'date', label: 'Date', children: audit.date },
          { key: 'location', label: 'Location', children: audit.location || '—' },
          { key: 'items', label: 'Items counted', children: audit.lines.length },
          ...(audit.note
            ? [{ key: 'note', label: 'Note', span: 3, children: audit.note }]
            : []),
        ]}
      />

      <Table<AuditLine>
        rowKey="itemId"
        columns={columns}
        dataSource={audit.lines}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default AuditDetailPage
