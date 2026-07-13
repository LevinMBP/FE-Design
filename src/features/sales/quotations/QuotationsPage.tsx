import { Link, useNavigate } from 'react-router-dom'
import { App, Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useGetQuotationsQuery,
  useSetQuotationStatusMutation,
} from '../salesDocsApi'
import { peso, QUOTATION_STATUS } from '../salesDocMath'
import type { Quotation, QuotationStatus, SalesDocLine } from '../types'

const lineColumns: ColumnsType<SalesDocLine> = [
  { title: 'Item', dataIndex: 'itemName' },
  { title: 'Packaging', dataIndex: 'packaging', render: (v: string) => v || '—' },
  { title: 'Description', dataIndex: 'description', render: (v: string) => v || '—' },
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

function QuotationsPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data: quotations, isLoading } = useGetQuotationsQuery()
  const [setStatus, { isLoading: updating }] = useSetQuotationStatusMutation()

  const move = async (id: string, status: QuotationStatus, label: string) => {
    try {
      await setStatus({ id, status }).unwrap()
      message.success(`Quotation marked ${label}.`)
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not update quotation.')
    }
  }

  const convert = (q: Quotation) =>
    navigate('/sales/invoices/new', { state: { quotationId: q.id } })

  const columns: ColumnsType<Quotation> = [
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
      title: 'Expiry',
      dataIndex: 'expiryDate',
      render: (d: string) => dayjs(d).format('MMM D, YYYY'),
    },
    { title: 'Customer', dataIndex: 'customerName', render: (v: string) => v || '—' },
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: QuotationStatus) => {
        const meta = QUOTATION_STATUS[s]
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_, q) => {
        if (q.status === 'converted') {
          return <span style={{ color: 'var(--text-muted)' }}>Invoiced</span>
        }
        return (
          <Space size="small" wrap>
            {q.status === 'draft' && (
              <Button size="small" disabled={updating} onClick={() => move(q.id, 'sent', 'sent')}>
                Mark sent
              </Button>
            )}
            {q.status === 'sent' && (
              <>
                <Button
                  size="small"
                  disabled={updating}
                  onClick={() => move(q.id, 'accepted', 'accepted')}
                >
                  Accepted
                </Button>
                <Button
                  size="small"
                  disabled={updating}
                  onClick={() => move(q.id, 'declined', 'declined')}
                >
                  Declined
                </Button>
              </>
            )}
            {(q.status === 'draft' ||
              q.status === 'sent' ||
              q.status === 'accepted') && (
              <Button type="primary" size="small" onClick={() => convert(q)}>
                Convert to invoice
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Quotations</h1>
          <p>Price offers for customers. Convert an accepted quote into an invoice.</p>
        </div>
        <Link to="/sales/quotations/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New quotation
          </Button>
        </Link>
      </div>

      <Table<Quotation>
        rowKey="id"
        columns={columns}
        dataSource={quotations}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No quotations yet. Create your first offer.' }}
        expandable={{
          expandedRowRender: (r) => (
            <Table<SalesDocLine>
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

export default QuotationsPage
