import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetPurchasesQuery } from '../inventory/inventoryApi'
import {
  PURCHASE_TYPE_LABELS,
  purchasePaymentStatus,
  type PaymentStatus,
  type Purchase,
  type PurchaseLine,
  type PurchaseType,
} from '../inventory/types'
import PayPurchaseModal from './PayPurchaseModal'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const TYPE_COLOR: Record<PurchaseType, string> = {
  material: 'blue',
  product: 'geekblue',
  asset: 'purple',
  service: 'cyan',
  expense: 'gold',
}

/** Distinct line types on a purchase, in a stable order. */
const lineTypes = (p: Purchase): PurchaseType[] => {
  const order: PurchaseType[] = ['material', 'product', 'asset', 'service', 'expense']
  const present = new Set(p.lines.map((l) => l.type))
  return order.filter((t) => present.has(t))
}

const PAYMENT_TAG: Record<PaymentStatus, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'error' },
  partial: { label: 'Partial', color: 'warning' },
  paid: { label: 'Paid', color: 'success' },
}

const outstandingOf = (p: Purchase) =>
  Math.round((p.netPayable - p.amountPaid) * 100) / 100

const columns: ColumnsType<Purchase> = [
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
  {
    title: 'Type',
    key: 'type',
    render: (_, r) => (
      <>
        {lineTypes(r).map((t) => (
          <Tag color={TYPE_COLOR[t]} key={t}>
            {PURCHASE_TYPE_LABELS[t]}
          </Tag>
        ))}
      </>
    ),
  },
  { title: 'Vendor', dataIndex: 'vendorName', render: (v: string) => v || '—' },
  {
    title: 'Due',
    dataIndex: 'dueDate',
    render: (d: string) => (d ? dayjs(d).format('MMM D, YYYY') : '—'),
  },
  {
    title: 'Subtotal',
    dataIndex: 'subtotal',
    align: 'right',
    render: (v: number) => peso(v),
  },
  {
    title: 'Tax',
    dataIndex: 'taxAmount',
    align: 'right',
    render: (v: number) => (v > 0 ? peso(v) : '—'),
  },
  {
    title: 'Total',
    dataIndex: 'total',
    align: 'right',
    render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
  },
  {
    title: 'Payment',
    key: 'payment',
    render: (_, r) => {
      const status = purchasePaymentStatus(r)
      const tag = PAYMENT_TAG[status]
      return (
        <div>
          <Tag color={tag.color}>{tag.label}</Tag>
          {status !== 'paid' && (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
              {peso(outstandingOf(r))} left
            </div>
          )}
        </div>
      )
    },
  },
]

const lineColumns: ColumnsType<PurchaseLine> = [
  {
    title: 'Type',
    dataIndex: 'type',
    render: (t: PurchaseType) => <Tag color={TYPE_COLOR[t]}>{PURCHASE_TYPE_LABELS[t]}</Tag>,
  },
  { title: 'Item / description', dataIndex: 'itemName' },
  { title: 'Location', dataIndex: 'locationName', render: (v: string) => v || '—' },
  { title: 'Qty', dataIndex: 'quantity', align: 'right', render: (q: number, r) => `${q}${r.unit ? ' ' + r.unit : ''}` },
  { title: 'Unit cost', dataIndex: 'unitCost', align: 'right', render: (v: number) => peso(v) },
  {
    title: 'Tax',
    key: 'tax',
    align: 'right',
    render: (_, r) =>
      r.taxes.length ? (
        <span title={r.taxes.map((t) => t.label).join(', ')}>{peso(r.taxAmount)}</span>
      ) : (
        '—'
      ),
  },
  { title: 'Line total', dataIndex: 'lineTotal', align: 'right', render: (v: number) => peso(v) },
]

function PurchasesPage() {
  const { data: purchases, isLoading } = useGetPurchasesQuery()
  const [paying, setPaying] = useState<Purchase | null>(null)

  const actionColumn: ColumnsType<Purchase>[number] = {
    title: '',
    key: 'action',
    align: 'right',
    render: (_, r) =>
      purchasePaymentStatus(r) === 'paid' ? (
        <span className="text-tertiary">Settled</span>
      ) : (
        <Button size="small" type="primary" ghost onClick={() => setPaying(r)}>
          Pay
        </Button>
      ),
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Purchase Orders</h1>
          <p>Receive products and materials into stock (the only way to add inventory).</p>
        </div>
        <Link to="/purchases/orders/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New purchase
          </Button>
        </Link>
      </div>

      <Table<Purchase>
        rowKey="id"
        columns={[...columns, actionColumn]}
        dataSource={purchases}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No purchases yet. Receive stock with your first one.' }}
        expandable={{
          expandedRowRender: (r) => (
            <>
              <Table<PurchaseLine>
                columns={lineColumns}
                dataSource={r.lines.map((l, i) => ({ ...l, key: i }))}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '12px 2px 0', color: 'var(--text-muted)' }}>
                <span>Subtotal: <strong>{peso(r.subtotal)}</strong></span>
                {r.taxSummary.map((t) => (
                  <span key={t.taxId}>{t.label}: {peso(t.amount)}</span>
                ))}
                <span>Total: <strong>{peso(r.total)}</strong></span>
                <span>Paid: {peso(r.amountPaid)}</span>
                <span>Outstanding: <strong>{peso(outstandingOf(r))}</strong></span>
              </div>
            </>
          ),
        }}
      />

      <PayPurchaseModal purchase={paying} onClose={() => setPaying(null)} />
    </div>
  )
}

export default PurchasesPage
