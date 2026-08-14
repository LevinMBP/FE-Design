import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetPaymentsQuery, useGetPurchasesQuery } from '../../inventory/inventoryApi'
import { purchaseOutstanding, type Payment, type PaymentAllocation } from '../../inventory/types'
import { round2 } from '../../../shared/settlement'
import '../../../shared/styles/settlement.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const allocationColumns: ColumnsType<PaymentAllocation> = [
  {
    title: 'Purchase order',
    dataIndex: 'purchaseRef',
    render: (v: string) => <strong>{v}</strong>,
  },
  {
    title: 'Order date',
    dataIndex: 'purchaseDate',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  {
    title: 'Order payable',
    dataIndex: 'purchaseTotal',
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

const columns: ColumnsType<Payment> = [
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
  { title: 'Vendor', dataIndex: 'vendorName', render: (v: string) => v || '—' },
  {
    title: 'Method',
    dataIndex: 'paymentMethodName',
    render: (v: string) => <Tag>{v}</Tag>,
  },
  {
    title: 'Allocated to',
    key: 'allocations',
    render: (_, r) => (
      <span>
        {r.allocations.length} order{r.allocations.length === 1 ? '' : 's'}
        <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
          {r.allocations.map((a) => a.purchaseRef).join(', ')}
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
    title: 'Withholding',
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
    title: 'Cash paid',
    dataIndex: 'cashAmount',
    align: 'right',
    render: (v: number) => peso(v),
  },
]

/**
 * Vendor payments — every settlement of Accounts Payable, each one allocated
 * across the purchase orders it paid down. Expand a row for the split.
 */
function PaymentsPage() {
  const { data: payments, isLoading } = useGetPaymentsQuery()
  const { data: purchases } = useGetPurchasesQuery()

  const outstanding = purchases
    ? round2(purchases.reduce((s, p) => s + purchaseOutstanding(p), 0))
    : null
  const paidTotal = payments
    ? round2(payments.reduce((s, p) => s + p.amount, 0))
    : null

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Vendor Payments</h1>
          <p>
            Pay vendors and allocate each payment across their open purchase
            orders. {outstanding != null && (
              <>
                <strong>{peso(outstanding)}</strong> still payable
                {paidTotal != null && <> · {peso(paidTotal)} paid to date</>}.
              </>
            )}
          </p>
        </div>
        <Link to="/purchases/payments/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New payment
          </Button>
        </Link>
      </div>

      <Table<Payment>
        rowKey="id"
        columns={columns}
        dataSource={payments}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No payments yet. Settle a purchase order to get started.' }}
        expandable={{
          expandedRowRender: (r) => (
            <>
              <Table<PaymentAllocation>
                rowKey="purchaseId"
                columns={allocationColumns}
                dataSource={r.allocations}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
              <div className="settle-alloc-note">
                <span>
                  Paid via <strong>{r.paymentMethodName}</strong>
                </span>
                <span>
                  Payables settled: <strong>{peso(r.amount)}</strong>
                </span>
                {r.withholdingTotal > 0 && (
                  <span>
                    {r.withholdingLabel} withheld: <strong>{peso(r.withholdingTotal)}</strong>{' '}
                    (remitted to the BIR, not the vendor)
                  </span>
                )}
                <span>
                  Cash out: <strong>{peso(r.cashAmount)}</strong>
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

export default PaymentsPage
