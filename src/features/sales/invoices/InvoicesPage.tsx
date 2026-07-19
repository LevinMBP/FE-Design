import { Link } from 'react-router-dom'
import { App, Button, Popconfirm, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useGetInvoicesQuery,
  useMarkInvoicePaidMutation,
  useSendInvoiceMutation,
} from '../salesDocsApi'
import { INVOICE_STATUS, peso } from '../salesDocMath'
import type { Invoice, InvoiceStatus, SalesDocLine } from '../types'

const lineColumns: ColumnsType<SalesDocLine> = [
  { title: 'Item', dataIndex: 'itemName' },
  {
    title: 'Kind',
    dataIndex: 'itemKind',
    render: (k: string) => (k === 'material' ? 'Material' : 'Product'),
  },
  {
    title: 'Qty',
    dataIndex: 'quantity',
    align: 'right',
    render: (q: number, r) => `${q} ${r.unit}`,
  },
  {
    title: 'Unit price',
    dataIndex: 'unitPrice',
    align: 'right',
    render: (v: number) => peso(v),
  },
  {
    title: 'Line total',
    align: 'right',
    render: (_, r) => peso(r.quantity * r.unitPrice),
  },
]

function InvoicesPage() {
  const { message } = App.useApp()
  const { data: invoices, isLoading } = useGetInvoicesQuery()
  const [send, { isLoading: sending }] = useSendInvoiceMutation()
  const [markPaid, { isLoading: paying }] = useMarkInvoicePaidMutation()

  const doSend = async (inv: Invoice) => {
    try {
      await send(inv.id).unwrap()
      message.success(`Invoice ${inv.reference} sent — stock issued.`)
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not send invoice.')
    }
  }

  const doPaid = async (inv: Invoice) => {
    try {
      await markPaid(inv.id).unwrap()
      message.success(`Invoice ${inv.reference} marked paid.`)
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not update invoice.')
    }
  }

  const columns: ColumnsType<Invoice> = [
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
      title: 'Due',
      dataIndex: 'dueDate',
      render: (d: string, r) => (
        <>
          {dayjs(d).format('MMM D, YYYY')}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.paymentTerm}</div>
        </>
      ),
    },
    { title: 'Customer', dataIndex: 'customerName', render: (v: string) => v || '—' },
    {
      title: 'Tax',
      dataIndex: 'taxBreakdown',
      render: (rows: Invoice['taxBreakdown']) =>
        rows.length ? rows.map((r) => r.label).join(' + ') : '—',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: InvoiceStatus) => {
        const meta = INVOICE_STATUS[s]
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_, inv) => (
        <Space size="small" wrap>
          {inv.status === 'draft' && (
            <Popconfirm
              title="Send this invoice?"
              description="This issues the items out of stock."
              okText="Send"
              onConfirm={() => doSend(inv)}
            >
              <Button type="primary" size="small" loading={sending}>
                Send
              </Button>
            </Popconfirm>
          )}
          {inv.status === 'sent' && (
            <Button size="small" loading={paying} onClick={() => doPaid(inv)}>
              Mark paid
            </Button>
          )}
          {inv.status === 'paid' && (
            <span style={{ color: 'var(--text-muted)' }}>Settled</span>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p>Bill customers. Sending an invoice issues stock out (the sale).</p>
        </div>
        <Link to="/sales/invoices/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New invoice
          </Button>
        </Link>
      </div>

      <Table<Invoice>
        rowKey="id"
        columns={columns}
        dataSource={invoices}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No invoices yet. Bill a customer to get started.' }}
        expandable={{
          expandedRowRender: (r) => (
            <>
              <Table<SalesDocLine>
                rowKey={(l) => `${l.itemKind}:${l.itemId}`}
                columns={lineColumns}
                dataSource={r.lines}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '12px 2px 0', color: 'var(--text-muted)' }}>
                <span>Gross (before tax): <strong>{peso(r.gross)}</strong></span>
                {r.discountAmount > 0 && <span>Discount: −{peso(r.discountAmount)}</span>}
                <span>Tax: <strong>{peso(r.taxAmount)}</strong></span>
                <span>Final total: <strong>{peso(r.total)}</strong></span>
                <span>Location: {r.location || '—'}</span>
                <span>Delivery receipt: {r.deliveryReceipt || '—'}</span>
              </div>
              {r.notes && (
                <p style={{ margin: '10px 2px 0', color: 'var(--text-muted)' }}>
                  <strong>Notes:</strong> {r.notes}
                </p>
              )}
            </>
          ),
        }}
      />
    </div>
  )
}

export default InvoicesPage
