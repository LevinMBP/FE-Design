import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DatePicker, Segmented, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Coins, PackagePlus, Receipt, Wallet } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useGetMonthlyPurchasesByItemQuery,
  useGetMonthlyPurchasesByOrderQuery,
  useGetMonthlyPurchasesByVendorQuery,
  useGetPurchasesByItemQuery,
  useGetPurchasesByOrderQuery,
  useGetPurchasesByVendorQuery,
} from '../../inventory/inventoryApi'
import {
  PURCHASE_TYPE_COLOR,
  PURCHASE_TYPE_LABELS,
  type PaymentStatus,
  type PurchaseType,
} from '../../inventory/types'
import type {
  ItemPurchaseRow,
  OrderPurchaseEntry,
  OrderPurchaseRow,
  PurchaseBreakdownTotals,
  PurchaseItemEntry,
  VendorPurchaseRow,
} from '../../inventory/purchaseBreakdown'
import { SETTLEMENT_TAG } from '../../../shared/settlement'
import '../../../shared/styles/report.css'

const { RangePicker } = DatePicker

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)
const qty = (v: number) => (
  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
)
const pct = (v: number) => `${v.toFixed(1)}%`
const round2 = (n: number) => Math.round(n * 100) / 100

const statusTag = (s: PaymentStatus) => (
  <Tag color={SETTLEMENT_TAG[s].color}>{SETTLEMENT_TAG[s].label}</Tag>
)

const typeTag = (t: PurchaseType) => (
  <Tag color={PURCHASE_TYPE_COLOR[t]}>{PURCHASE_TYPE_LABELS[t]}</Tag>
)

/** SKU where there is one (stock items), the purchase type either way. */
const itemSubLabel = (r: { sku: string; type: PurchaseType }) =>
  r.sku && r.sku !== '—'
    ? `${r.sku} · ${PURCHASE_TYPE_LABELS[r.type]}`
    : PURCHASE_TYPE_LABELS[r.type]

/** Quick ranges the report opens with; 'all' skips date filtering entirely. */
const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom' },
] as const
type Period = (typeof PERIODS)[number]['value']

type Group = 'item' | 'order' | 'vendor'
/** 'flat' = one continuous table; 'month' = a section per month. */
type Split = 'flat' | 'month'

function rangeFor(period: Period, custom: [Dayjs, Dayjs] | null) {
  const today = dayjs()
  switch (period) {
    case '30':
      return { from: today.subtract(30, 'day').format('YYYY-MM-DD') }
    case '90':
      return { from: today.subtract(90, 'day').format('YYYY-MM-DD') }
    case 'ytd':
      return { from: today.startOf('year').format('YYYY-MM-DD') }
    case 'custom':
      return custom
        ? {
            from: custom[0].format('YYYY-MM-DD'),
            to: custom[1].format('YYYY-MM-DD'),
          }
        : {}
    default:
      return {}
  }
}

/** What all three groupings have in common: a key and the money figures. */
interface MoneyRow {
  key: string
  net: number
  tax: number
  total: number
}

/** Running totals down the report, and the share of the period reached so far. */
interface Cumulative {
  net: number
  netPct: number
  total: number
}

/**
 * The orders behind one item or one vendor. The vendor view drops the vendor
 * column — every row on it names the same supplier.
 */
const orderEntryColumns = (showVendor: boolean): ColumnsType<OrderPurchaseEntry> => [
  {
    title: 'Order',
    dataIndex: 'reference',
    render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Date',
    dataIndex: 'date',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  ...(showVendor
    ? [
        {
          title: 'Vendor',
          dataIndex: 'vendorName',
          render: (v: string) => v || '—',
        } as ColumnsType<OrderPurchaseEntry>[number],
      ]
    : []),
  { title: 'Payment', dataIndex: 'status', render: statusTag },
  { title: 'Qty', dataIndex: 'quantity', align: 'right', render: qty },
  {
    title: 'Net spend',
    dataIndex: 'net',
    align: 'right',
    render: (v: number) => peso(v),
  },
  { title: 'Input tax', dataIndex: 'tax', align: 'right', render: (v: number) => peso(v) },
  {
    title: 'Total',
    dataIndex: 'total',
    align: 'right',
    render: (v: number) => <strong>{peso(v)}</strong>,
  },
]

/** The items behind one order (per-order view). */
const itemEntryColumns: ColumnsType<PurchaseItemEntry> = [
  {
    title: 'Item / description',
    dataIndex: 'itemName',
    render: (name: string, r) => (
      <>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{itemSubLabel(r)}</div>
      </>
    ),
  },
  { title: 'Type', dataIndex: 'type', render: typeTag },
  {
    title: 'Qty',
    dataIndex: 'quantity',
    align: 'right',
    render: (v: number, r) => (
      <>
        {qty(v)} <span style={{ color: 'var(--text-muted)' }}>{r.unit}</span>
      </>
    ),
  },
  {
    title: 'Net spend',
    dataIndex: 'net',
    align: 'right',
    render: (v: number) => peso(v),
  },
  { title: 'Input tax', dataIndex: 'tax', align: 'right', render: (v: number) => peso(v) },
  {
    title: 'Total',
    dataIndex: 'total',
    align: 'right',
    render: (v: number) => <strong>{peso(v)}</strong>,
  },
]

/** Rows expanded under an item row (the orders it was bought on). */
const expandItem = {
  expandedRowRender: (r: ItemPurchaseRow) => (
    <Table<OrderPurchaseEntry>
      rowKey="orderId"
      columns={orderEntryColumns(true)}
      dataSource={r.entries}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
    />
  ),
}

/** Rows expanded under a vendor row (that vendor's orders). */
const expandVendor = {
  expandedRowRender: (r: VendorPurchaseRow) => (
    <Table<OrderPurchaseEntry>
      rowKey="orderId"
      columns={orderEntryColumns(false)}
      dataSource={r.entries}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
    />
  ),
}

/** Rows expanded under an order row (its items + the document's own figures). */
const expandOrder = {
  expandedRowRender: (r: OrderPurchaseRow) => (
    <>
      <Table<PurchaseItemEntry>
        rowKey="key"
        columns={itemEntryColumns}
        dataSource={r.entries}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
      />
      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          margin: '12px 2px 0',
          color: 'var(--text-muted)',
        }}
      >
        <span>
          Net spend: <strong>{peso(r.net)}</strong>
        </span>
        {r.discountAmount > 0 && <span>Discount: −{peso(r.discountAmount)}</span>}
        <span>Input tax: {peso(r.tax)}</span>
        <span>
          Order total: <strong>{peso(r.orderTotal)}</strong>
        </span>
        <span>Paid: {peso(r.paid)}</span>
        <span>
          Outstanding: <strong>{peso(r.outstanding)}</strong>
        </span>
      </div>
    </>
  ),
}

function PurchaseBreakdownPage() {
  const [group, setGroup] = useState<Group>('item')
  const [split, setSplit] = useState<Split>('flat')
  const [period, setPeriod] = useState<Period>('all')
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null)
  // Row order as the table currently displays it, so the running total follows
  // whatever the user sorted by rather than the order the report shipped in.
  const [sortKeys, setSortKeys] = useState<string[] | null>(null)

  const filter = useMemo(() => rangeFor(period, custom), [period, custom])
  const flat = split === 'flat'
  const byItem = useGetPurchasesByItemQuery(filter, { skip: !flat || group !== 'item' })
  const byOrder = useGetPurchasesByOrderQuery(filter, {
    skip: !flat || group !== 'order',
  })
  const byVendor = useGetPurchasesByVendorQuery(filter, {
    skip: !flat || group !== 'vendor',
  })
  const monthlyByItem = useGetMonthlyPurchasesByItemQuery(filter, {
    skip: flat || group !== 'item',
  })
  const monthlyByOrder = useGetMonthlyPurchasesByOrderQuery(filter, {
    skip: flat || group !== 'order',
  })
  const monthlyByVendor = useGetMonthlyPurchasesByVendorQuery(filter, {
    skip: flat || group !== 'vendor',
  })

  const flatQuery =
    group === 'item' ? byItem : group === 'order' ? byOrder : byVendor
  const monthlyQuery =
    group === 'item'
      ? monthlyByItem
      : group === 'order'
        ? monthlyByOrder
        : monthlyByVendor
  const active = flat ? flatQuery : monthlyQuery
  const totals = active.data?.totals

  const flatRows: MoneyRow[] = useMemo(
    () => (flat ? ((flatQuery.data?.rows ?? []) as MoneyRow[]) : []),
    [flat, flatQuery.data],
  )

  /** Running totals per row key, accumulated in display order (flat view). */
  const cumulative = useMemo(() => {
    const rank = sortKeys ? new Map(sortKeys.map((k, i) => [k, i])) : null
    // Rows the saved order doesn't know about (a period change) fall to the end
    // and the map self-heals on the next sort.
    const ordered = rank
      ? [...flatRows].sort(
          (a, b) =>
            (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER),
        )
      : flatRows
    const periodNet = ordered.reduce((s, r) => s + r.net, 0)
    const map = new Map<string, Cumulative>()
    let net = 0
    let total = 0
    for (const row of ordered) {
      net = round2(net + row.net)
      total = round2(total + row.total)
      map.set(row.key, {
        net,
        total,
        netPct: periodNet > 0 ? (net / periodNet) * 100 : 0,
      })
    }
    return map
  }, [flatRows, sortKeys])

  /** A running total cell: the amount so far, with an optional share below. */
  const runningCell = (value: number | undefined, sub?: string) =>
    value == null ? (
      '—'
    ) : (
      <>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{peso(value)}</span>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
      </>
    )

  /**
   * Money columns shared by every grouping. `outstanding` is only shown where a
   * row *is* one or more whole orders — settlement belongs to the document, and
   * splitting it across the items on an order would be inventing a figure. The
   * per-row running totals only make sense in the flat view; in monthly mode
   * they live in each month's footer instead.
   */
  function moneyColumns<T extends MoneyRow>(
    withRunning: boolean,
    withOutstanding: boolean,
  ): ColumnsType<T> {
    const cols: ColumnsType<T> = [
      {
        title: 'Net spend',
        dataIndex: 'net',
        align: 'right',
        sorter: (a, b) => a.net - b.net,
        render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
      },
      {
        title: 'Input tax',
        dataIndex: 'tax',
        align: 'right',
        sorter: (a, b) => a.tax - b.tax,
        render: (v: number) => peso(v),
      },
      {
        title: 'Total',
        dataIndex: 'total',
        align: 'right',
        sorter: (a, b) => a.total - b.total,
        render: (v: number) => peso(v),
      },
    ]
    if (withOutstanding) {
      cols.push({
        title: 'Outstanding',
        dataIndex: 'outstanding',
        align: 'right',
        sorter: (a, b) =>
          ((a as { outstanding?: number }).outstanding ?? 0) -
          ((b as { outstanding?: number }).outstanding ?? 0),
        render: (v: number) => (
          <span style={{ color: v > 0 ? 'var(--color-danger-text)' : undefined }}>
            {peso(v)}
          </span>
        ),
      })
    }
    if (!withRunning) return cols
    return [
      ...cols,
      {
        title: 'Cumulative spend',
        key: 'cumulativeNet',
        align: 'right',
        render: (_, r) => {
          const c = cumulative.get(r.key)
          return runningCell(c?.net, c ? `${pct(c.netPct)} of period` : undefined)
        },
      },
      {
        title: 'Cumulative payable',
        key: 'cumulativeTotal',
        align: 'right',
        render: (_, r) => runningCell(cumulative.get(r.key)?.total),
      },
    ]
  }

  const itemColumns = (withRunning: boolean): ColumnsType<ItemPurchaseRow> => [
    {
      title: 'Item / description',
      dataIndex: 'itemName',
      render: (name: string, r) => (
        <>
          <span style={{ fontWeight: 600 }}>{name}</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {itemSubLabel(r)}
          </div>
        </>
      ),
    },
    {
      title: 'Qty bought',
      dataIndex: 'quantity',
      align: 'right',
      sorter: (a, b) => a.quantity - b.quantity,
      render: (v: number, r) => (
        <>
          {qty(v)} <span style={{ color: 'var(--text-muted)' }}>{r.unit}</span>
        </>
      ),
    },
    ...moneyColumns<ItemPurchaseRow>(withRunning, false),
    {
      title: 'Orders',
      dataIndex: 'orderCount',
      align: 'right',
      sorter: (a, b) => a.orderCount - b.orderCount,
      render: qty,
    },
    {
      title: 'Vendors',
      dataIndex: 'vendorCount',
      align: 'right',
      sorter: (a, b) => a.vendorCount - b.vendorCount,
      render: qty,
    },
  ]

  const orderColumns = (withRunning: boolean): ColumnsType<OrderPurchaseRow> => [
    {
      title: 'Order',
      dataIndex: 'reference',
      render: (v: string, r) => (
        <>
          <span style={{ fontWeight: 600 }}>{v}</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            due {r.dueDate ? dayjs(r.dueDate).format('MMM D, YYYY') : '—'}
          </div>
        </>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      sorter: (a, b) => a.date.localeCompare(b.date),
      render: (d: string) => dayjs(d).format('MMM D, YYYY'),
    },
    { title: 'Vendor', dataIndex: 'vendorName', render: (v: string) => v || '—' },
    { title: 'Payment', dataIndex: 'status', render: statusTag },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      align: 'right',
      sorter: (a, b) => a.quantity - b.quantity,
      render: qty,
    },
    ...moneyColumns<OrderPurchaseRow>(withRunning, true),
    {
      title: 'Items',
      dataIndex: 'itemCount',
      align: 'right',
      sorter: (a, b) => a.itemCount - b.itemCount,
      render: qty,
    },
  ]

  const vendorColumns = (withRunning: boolean): ColumnsType<VendorPurchaseRow> => [
    {
      title: 'Vendor',
      dataIndex: 'vendorName',
      render: (v: string, r) => (
        <>
          <span style={{ fontWeight: 600 }}>{v || 'Unassigned'}</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            last order {dayjs(r.lastOrder).format('MMM D, YYYY')}
          </div>
        </>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      align: 'right',
      sorter: (a, b) => a.quantity - b.quantity,
      render: qty,
    },
    ...moneyColumns<VendorPurchaseRow>(withRunning, true),
    {
      title: 'Orders',
      dataIndex: 'orderCount',
      align: 'right',
      sorter: (a, b) => a.orderCount - b.orderCount,
      render: qty,
    },
    {
      title: 'Items',
      dataIndex: 'itemCount',
      align: 'right',
      sorter: (a, b) => a.itemCount - b.itemCount,
      render: qty,
    },
  ]

  /** How many label columns precede the figures, per grouping. */
  const lead = group === 'order' ? 4 : 1
  /** How many columns trail them (counts). */
  const trailing = group === 'order' ? 1 : 2
  /** Only order and vendor rows carry a settlement column. */
  const withOutstanding = group !== 'item'

  /**
   * One footer row of totals. The figures line up with `moneyColumns` above:
   * qty, net, tax, total, [outstanding], [cumulative pair].
   */
  const totalsRow = (opts: {
    rowKey: string
    label: ReactNode
    totals: PurchaseBreakdownTotals
    running?: boolean
    muted?: boolean
  }) => {
    const { totals: t, muted } = opts
    const rowClass = muted ? 'report-cumulative-row' : 'report-total-row'
    const figures: ReactNode[] = [
      t.quantity.toLocaleString(),
      peso(t.net),
      peso(t.tax),
      peso(t.total),
    ]
    if (withOutstanding) figures.push(peso(t.outstanding))
    // The per-row running totals land on the period totals by the last row.
    if (opts.running) figures.push(peso(t.net), peso(t.total))

    return (
      <Table.Summary.Row key={opts.rowKey} className={rowClass}>
        <Table.Summary.Cell index={0} colSpan={lead + 1}>
          <span className={`${rowClass}__label`}>{opts.label}</span>
        </Table.Summary.Cell>
        {figures.map((figure, i) => (
          <Table.Summary.Cell key={i} index={i + 1} align="right">
            <span className="report-figure">{figure}</span>
          </Table.Summary.Cell>
        ))}
        <Table.Summary.Cell
          index={figures.length + 1}
          colSpan={trailing}
          align="right"
        />
      </Table.Summary.Row>
    )
  }

  /** Flat view footer: the period's totals. */
  const periodSummary = () =>
    totals
      ? () => (
          <Table.Summary fixed>
            {totalsRow({
              rowKey: 'period',
              label: `Total · ${totals.orderCount} orders · ${totals.itemCount} items · ${totals.vendorCount} vendors`,
              totals,
              running: true,
            })}
          </Table.Summary>
        )
      : undefined

  /** Monthly view footer: this month's totals, then everything up to it. */
  const monthSummary = (section: {
    label: string
    totals: PurchaseBreakdownTotals
    cumulative: PurchaseBreakdownTotals
  }) => (
    <Table.Summary fixed>
      {totalsRow({
        rowKey: 'month',
        label: `${section.label} total`,
        totals: section.totals,
      })}
      {totalsRow({
        rowKey: 'cumulative',
        label: `Cumulative through ${section.label}`,
        totals: section.cumulative,
        muted: true,
      })}
    </Table.Summary>
  )

  const tableProps = {
    style: { marginTop: 16 },
    pagination: { pageSize: 25, hideOnSinglePage: true, showSizeChanger: true },
    scroll: { x: 'max-content' as const },
    locale: {
      emptyText:
        'No purchases in this period. Raise a purchase order to bring stock in.',
    },
  }

  /**
   * Month sections stack tables, so each one paginates: a busy month must not
   * put hundreds of rows in the DOM. The footers stay month-wide — they read
   * the section's totals, not the visible page.
   */
  const monthTableProps = { ...tableProps, style: undefined }

  const sections = flat ? [] : monthlyQuery.data?.sections ?? []

  /** The flat table for the current grouping — same shell, different pivot. */
  const flatTable = () => {
    const shared = {
      ...tableProps,
      rowKey: 'key' as const,
      loading: flatQuery.isFetching,
      summary: periodSummary(),
    }
    if (group === 'item') {
      return (
        <Table<ItemPurchaseRow>
          {...shared}
          columns={itemColumns(true)}
          dataSource={byItem.data?.rows}
          onChange={(_p, _f, _s, extra) =>
            setSortKeys(extra.currentDataSource.map((r) => r.key))
          }
          expandable={expandItem}
        />
      )
    }
    if (group === 'order') {
      return (
        <Table<OrderPurchaseRow>
          {...shared}
          columns={orderColumns(true)}
          dataSource={byOrder.data?.rows}
          onChange={(_p, _f, _s, extra) =>
            setSortKeys(extra.currentDataSource.map((r) => r.key))
          }
          expandable={expandOrder}
        />
      )
    }
    return (
      <Table<VendorPurchaseRow>
        {...shared}
        columns={vendorColumns(true)}
        dataSource={byVendor.data?.rows}
        onChange={(_p, _f, _s, extra) =>
          setSortKeys(extra.currentDataSource.map((r) => r.key))
        }
        expandable={expandVendor}
      />
    )
  }

  /** One month's table for the current grouping. */
  const monthTable = (section: (typeof sections)[number]) => {
    const shared = {
      ...monthTableProps,
      rowKey: 'key' as const,
      loading: monthlyQuery.isFetching,
      summary: () => monthSummary(section),
    }
    if (group === 'item') {
      return (
        <Table<ItemPurchaseRow>
          {...shared}
          columns={itemColumns(false)}
          dataSource={section.rows as ItemPurchaseRow[]}
          expandable={expandItem}
        />
      )
    }
    if (group === 'order') {
      return (
        <Table<OrderPurchaseRow>
          {...shared}
          columns={orderColumns(false)}
          dataSource={section.rows as OrderPurchaseRow[]}
          expandable={expandOrder}
        />
      )
    }
    return (
      <Table<VendorPurchaseRow>
        {...shared}
        columns={vendorColumns(false)}
        dataSource={section.rows as VendorPurchaseRow[]}
        expandable={expandVendor}
      />
    )
  }

  const emptyColumns = (
    group === 'item'
      ? itemColumns(false)
      : group === 'order'
        ? orderColumns(false)
        : vendorColumns(false)
  ) as ColumnsType<never>

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Purchase Breakdown</h1>
          <p>
            What was bought across purchase orders — spend net of the document
            discount, input tax carried separately. Expand a row to see the
            other side of the split.
          </p>
        </div>

        <Space className="page-head__actions" wrap>
          <Segmented
            value={group}
            onChange={(v) => {
              setGroup(v as Group)
              setSortKeys(null) // different entities, different order
            }}
            options={[
              { value: 'item', label: 'By item' },
              { value: 'order', label: 'By order' },
              { value: 'vendor', label: 'By vendor' },
            ]}
          />
          <Segmented
            value={split}
            onChange={(v) => setSplit(v as Split)}
            options={[
              { value: 'flat', label: 'All rows' },
              { value: 'month', label: 'Monthly' },
            ]}
          />
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
          />
          {period === 'custom' && (
            <RangePicker
              value={custom}
              onChange={(v) => setCustom(v as [Dayjs, Dayjs] | null)}
              allowClear
            />
          )}
        </Space>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={<PackagePlus size={20} />}
          label="Units bought"
          value={totals ? totals.quantity.toLocaleString() : '—'}
          tone="neutral"
        />
        <StatCard
          icon={<Coins size={20} />}
          label="Net spend (excl. tax)"
          value={totals ? peso(totals.net) : '—'}
          tone="brand"
        />
        <StatCard
          icon={<Receipt size={20} />}
          label="Input tax"
          value={totals ? peso(totals.tax) : '—'}
          tone="warn"
        />
        <StatCard
          icon={<Wallet size={20} />}
          label={
            totals
              ? totals.outstanding > 0
                ? `Payable · ${peso(totals.outstanding)} unpaid`
                : 'Payable · settled'
              : 'Payable'
          }
          value={totals ? peso(totals.total) : '—'}
          tone="green"
        />
      </div>

      {/* ---- Flat: one continuous table with per-row running totals ---- */}
      {flat && flatTable()}

      {/* ---- Monthly: a section per month, each closing with its own
              total and the running total through that month ---- */}
      {!flat && sections.length === 0 && (
        <Table
          {...tableProps}
          rowKey="key"
          columns={emptyColumns}
          dataSource={[]}
          loading={active.isFetching}
        />
      )}
      {!flat &&
        sections.map((section) => (
          <section key={section.key}>
            <div className="report-month">
              <h2 className="report-month__title">{section.label}</h2>
              <span className="report-month__meta">
                {section.totals.orderCount} orders · {section.totals.itemCount} items
                · {peso(section.totals.net)} net spend
              </span>
            </div>
            {monthTable(section)}
          </section>
        ))}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone: 'brand' | 'green' | 'warn' | 'neutral'
}) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>{icon}</div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

export default PurchaseBreakdownPage
