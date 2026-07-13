import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Checkbox, DatePicker, Input, Popover, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, Columns3, Search } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { useGetItemLedgerQuery } from '../inventoryApi'
import type {
  FifoLayer,
  LedgerLotSnapshot,
  LedgerRow,
  StockItemKind,
} from '../types'

const { RangePicker } = DatePicker

const money = (v: number) => `$${v.toFixed(2)}`
const num = (v: number) => (
  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
)
const dash = <span className="text-tertiary">—</span>

const columns: ColumnsType<LedgerRow> = [
  {
    key: 'txnNo',
    title: '#',
    dataIndex: 'txnNo',
    width: 56,
    render: (n: number, row) => (row.opening ? dash : n),
  },
  {
    key: 'date',
    title: 'Date',
    dataIndex: 'date',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  { key: 'source', title: 'Source', dataIndex: 'source' },
  {
    key: 'reference',
    title: 'Reference',
    dataIndex: 'reference',
    render: (ref: string, row) =>
      row.opening ? <span className="text-tertiary">{ref}</span> : ref,
  },
  {
    key: 'location',
    title: 'Location',
    dataIndex: 'location',
    render: (loc: string) => (loc === '—' ? dash : loc),
  },
  {
    key: 'in',
    title: 'In',
    align: 'right',
    render: (_, row) =>
      !row.opening && row.direction === 'in' ? (
        <span style={{ color: 'var(--color-success-text)' }}>{num(row.quantity)}</span>
      ) : (
        dash
      ),
  },
  {
    key: 'out',
    title: 'Out',
    align: 'right',
    render: (_, row) =>
      !row.opening && row.direction === 'out' ? (
        <span style={{ color: 'var(--color-danger-text)' }}>{num(row.quantity)}</span>
      ) : (
        dash
      ),
  },
  {
    key: 'balance',
    title: 'Balance',
    dataIndex: 'balance',
    align: 'right',
    render: (v: number) => <strong>{num(v)}</strong>,
  },
  {
    key: 'unitCost',
    title: 'Unit cost',
    dataIndex: 'unitCost',
    align: 'right',
    render: (v: number, row) => (row.opening ? dash : money(v)),
  },
  {
    key: 'value',
    title: 'Value',
    dataIndex: 'value',
    align: 'right',
    render: (v: number, row) => (row.opening ? dash : money(v)),
  },
  {
    key: 'stockValue',
    title: 'Stock value',
    dataIndex: 'stockValue',
    align: 'right',
    render: (v: number) => money(v),
  },
]

/** Toggleable columns for the column chooser (key → label). */
const COLUMN_OPTIONS = columns.map((c) => ({
  value: c.key as string,
  label: c.title as string,
}))
const ALL_COLUMN_KEYS = COLUMN_OPTIONS.map((o) => o.value)

/** Per-lot breakdown shown when a ledger row is expanded. */
const lotColumns: ColumnsType<LedgerLotSnapshot> = [
  { title: 'Lot', dataIndex: 'reference' },
  {
    title: 'Received',
    dataIndex: 'date',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  { title: 'Received qty', dataIndex: 'originalQty', align: 'right', render: num },
  {
    title: 'Left',
    dataIndex: 'left',
    align: 'right',
    render: (v: number) => <strong>{num(v)}</strong>,
  },
  { title: 'Unit cost', dataIndex: 'unitCost', align: 'right', render: money },
  {
    title: 'Value',
    align: 'right',
    render: (_, l) => money(l.left * l.unitCost),
  },
]

const layerColumns: ColumnsType<FifoLayer> = [
  { title: 'Received', dataIndex: 'date', render: (d: string) => dayjs(d).format('MMM D, YYYY') },
  { title: 'Reference', dataIndex: 'reference' },
  { title: 'Qty', dataIndex: 'quantity', align: 'right', render: num },
  { title: 'Unit cost', dataIndex: 'unitCost', align: 'right', render: money },
  {
    title: 'Value',
    dataIndex: 'value',
    align: 'right',
    render: (v: number) => <strong>{money(v)}</strong>,
  },
]

function isKind(v: string | undefined): v is StockItemKind {
  return v === 'material' || v === 'product'
}

function ItemLedgerPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [visibleCols, setVisibleCols] = useState<string[]>(ALL_COLUMN_KEYS)

  const shownColumns = useMemo(
    () => columns.filter((c) => visibleCols.includes(c.key as string)),
    [visibleCols],
  )

  const validKind = isKind(kind)
  const { data, isLoading, isError } = useGetItemLedgerQuery(
    validKind && id ? { kind, id } : { kind: 'material', id: '' },
    { skip: !validKind || !id },
  )

  const rows = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (row.opening) return true // always anchor the ledger with the opening row
      if (term && !row.reference.toLowerCase().includes(term)) return false
      if (range) {
        const d = dayjs(row.date)
        if (d.isBefore(range[0], 'day') || d.isAfter(range[1], 'day')) return false
      }
      return true
    })
  }, [data, search, range])

  if (!validKind || isError) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Item not found</h1>
            <p>
              This item has no stock ledger.{' '}
              <Link to="/inventory/stock">Back to Stock Overview</Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const item = data?.item

  return (
    <div className="module-view">
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            type="text"
            icon={<ArrowLeft size={18} />}
            onClick={() => navigate('/inventory/stock')}
            aria-label="Back to Stock Overview"
          />
          <div>
            <h1>{item ? `${item.name} — Transactions` : 'Transactions'}</h1>
            <p>
              {item
                ? `On hand: ${item.onHand.toLocaleString()} ${item.unit} · ${item.sku}`
                : 'Stock movement history.'}
            </p>
          </div>
        </div>

        <Space className="page-head__actions" wrap>
          <Input
            allowClear
            prefix={<Search size={15} />}
            placeholder="Search by reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <RangePicker
            value={range}
            onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
            allowClear
          />
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <Checkbox.Group
                value={visibleCols}
                onChange={(v) => setVisibleCols(v as string[])}
                options={COLUMN_OPTIONS}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              />
            }
          >
            <Button icon={<Columns3 size={16} />}>Columns</Button>
          </Popover>
        </Space>
      </div>

      {data && data.layers.length > 0 && (
        <div className="fifo-panel">
          <div className="fifo-panel__head">
            <span className="fifo-panel__title">Remaining stock — FIFO layers</span>
            <div className="fifo-panel__stats">
              <span>
                On hand <strong>{data.item.onHand.toLocaleString()}</strong>
              </span>
              <span>
                Avg cost <strong>{money(data.avgCost)}</strong>
              </span>
              <span>
                Stock value <strong>{money(data.stockValue)}</strong>
              </span>
            </div>
          </div>
          <Table<FifoLayer>
            rowKey={(l) => `${l.reference}-${l.date}`}
            columns={layerColumns}
            dataSource={data.layers}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      <Table<LedgerRow>
        rowKey="id"
        columns={shownColumns}
        dataSource={rows}
        loading={isLoading}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        rowClassName={(row) => (row.opening ? 'ledger-row--opening' : '')}
        expandable={{
          rowExpandable: (row) => !row.opening && row.lots.length > 0,
          expandedRowRender: (row) => (
            <div className="ledger-lots">
              <div className="ledger-lots__title">
                FIFO lots after this movement · Balance {row.balance.toLocaleString()}
              </div>
              <Table<LedgerLotSnapshot>
                rowKey={(l) => `${l.reference}-${l.date}`}
                columns={lotColumns}
                dataSource={row.lots}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </div>
          ),
        }}
      />
    </div>
  )
}

export default ItemLedgerPage
