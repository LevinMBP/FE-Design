import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetCollectionsQuery, useGetInvoicesQuery } from '../salesDocsApi'
import { useGetSalesQuery } from '../../inventory/inventoryApi'
import { openReceivables } from '../receivables'
import {
  RECEIVABLE_KIND_LABELS,
  type Collection,
  type CollectionAllocation,
  type ReceivableKind,
} from '../types'
import { round2 } from '../../../shared/settlement'
import '../../../shared/styles/settlement.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const KIND_COLOR: Record<ReceivableKind, string> = {
  invoice: 'geekblue',
  sale: 'purple',
}

const allocationColumns: ColumnsType<CollectionAllocation> = [
  {
    title: 'Document',
    dataIndex: 'docRef',
    render: (v: string, r) => (
      <span>
        <strong>{v}</strong>
        <Tag color={KIND_COLOR[r.docKind]} style={{ marginLeft: 8 }}>
          {RECEIVABLE_KIND_LABELS[r.docKind]}
        </Tag>
      </span>
    ),
  },
  {
    title: 'Document date',
    dataIndex: 'docDate',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  {
    title: 'Document total',
    dataIndex: 'docTotal',
    align: 'right',
    render: (v: number) => peso(v),
  },
  {
    title: 'Settled',
    dataIndex: 'amount',
    align: 'right',
    render: (v: number) => <strong>{peso(v)}</strong>,
  },
  {
    title: 'Withheld',
    dataIndex: 'withholdingTax',
    align: 'right',
    render: (v: number) => (v > 0 ? peso(v) : '—'),
  },
  {
    title: 'Net cash',
    key: 'net',
    align: 'right',
    render: (_, r) => peso(round2(r.amount - r.withholdingTax)),
  },
]

const columns: ColumnsType<Collection> = [
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
    title: 'Received through',
    dataIndex: 'paymentMethodName',
    render: (v: string) => <Tag>{v}</Tag>,
  },
  {
    title: 'Allocated to',
    key: 'allocations',
    render: (_, r) => (
      <span>
        {r.allocations.length} document{r.allocations.length === 1 ? '' : 's'}
        <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
          {r.allocations.map((a) => a.docRef).join(', ')}
        </div>
      </span>
    ),
  },
  {
    title: 'Settled',
    dataIndex: 'amount',
    align: 'right',
    render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
  },
  {
    title: 'Withheld',
    key: 'withholding',
    align: 'right',
    render: (_, r) =>
      r.withholdingTotal > 0 ? (
        <span>
          {peso(r.withholdingTotal)}
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
            {r.withholdingLabel}
          </div>
        </span>
      ) : (
        '—'
      ),
  },
  {
    title: 'Cash received',
    dataIndex: 'cashAmount',
    align: 'right',
    render: (v: number) => peso(v),
  },
]

/**
 * Customer collections — every settlement of Accounts Receivable, each one
 * allocated across the invoices and sales orders it cleared.
 */
function CollectionsPage() {
  const { data: collections, isLoading } = useGetCollectionsQuery()
  const { data: invoices } = useGetInvoicesQuery()
  const { data: sales } = useGetSalesQuery()

  const outstanding =
    invoices && sales
      ? round2(
          openReceivables(invoices, sales).reduce((s, r) => s + r.outstanding, 0),
        )
      : null
  const collectedTotal = collections
    ? round2(collections.reduce((s, c) => s + c.amount, 0))
    : null

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Collections</h1>
          <p>
            Record what customers pay you and allocate it across their open
            invoices and sales orders. {outstanding != null && (
              <>
                <strong>{peso(outstanding)}</strong> still receivable
                {collectedTotal != null && <> · {peso(collectedTotal)} collected to date</>}.
              </>
            )}
          </p>
        </div>
        <Link to="/sales/collections/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New collection
          </Button>
        </Link>
      </div>

      <Table<Collection>
        rowKey="id"
        columns={columns}
        dataSource={collections}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No collections yet. Settle an invoice to get started.' }}
        expandable={{
          expandedRowRender: (r) => (
            <>
              <Table<CollectionAllocation>
                rowKey={(a) => `${a.docKind}:${a.docId}`}
                columns={allocationColumns}
                dataSource={r.allocations}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
              <div className="settle-alloc-note">
                <span>
                  Received through <strong>{r.paymentMethodName}</strong>
                </span>
                <span>
                  Receivables settled: <strong>{peso(r.amount)}</strong>
                </span>
                {r.withholdingTotal > 0 && (
                  <span>
                    {r.withholdingLabel} withheld: <strong>{peso(r.withholdingTotal)}</strong>{' '}
                    (creditable — expect a 2307)
                  </span>
                )}
                <span>
                  Cash in: <strong>{peso(r.cashAmount)}</strong>
                </span>
                {r.note && <span>Note: {r.note}</span>}
              </div>
            </>
          ),
        }}
      />
    </div>
  )
}

export default CollectionsPage
