import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DatePicker, Segmented, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Boxes, Coins, PackageMinus, TrendingUp } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useGetMonthlySalesByInvoiceQuery,
  useGetMonthlySalesByItemQuery,
  useGetSalesByInvoiceQuery,
  useGetSalesByItemQuery,
} from '../salesDocsApi'
import { INVOICE_STATUS, peso } from '../salesDocMath'
import type {
  InvoiceItemEntry,
  InvoiceSalesRow,
  ItemSaleEntry,
  ItemSalesRow,
  SalesBreakdownTotals,
} from '../salesBreakdown'
import type { InvoiceStatus } from '../types'
import './SalesBreakdown.css'

const { RangePicker } = DatePicker

const qty = (v: number) => (
  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
)
const pct = (v: number) => `${v.toFixed(1)}%`
const round2 = (n: number) => Math.round(n * 100) / 100

const statusTag = (s: InvoiceStatus) => (
  <Tag color={INVOICE_STATUS[s].color}>{INVOICE_STATUS[s].label}</Tag>
)

const itemSubLabel = (r: { sku: string; itemKind: string }) =>
  `${r.sku} · ${r.itemKind === 'material' ? 'Material' : 'Product'}`

/** Quick ranges the report opens with; 'all' skips date filtering entirely. */
const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom' },
] as const
type Period = (typeof PERIODS)[number]['value']

type Group = 'item' | 'invoice'
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

/** What both groupings have in common: a key and the four money figures. */
interface MoneyRow {
  key: string
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

/** Running totals down the report, and the share of the period reached so far. */
interface Cumulative {
  revenue: number
  revenuePct: number
  margin: number
}

/** The invoices behind one item (per-item view). */
const invoiceEntryColumns: ColumnsType<ItemSaleEntry> = [
  {
    title: 'Invoice',
    dataIndex: 'reference',
    render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Date',
    dataIndex: 'date',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  { title: 'Customer', dataIndex: 'customerName', render: (v: string) => v || '—' },
  { title: 'Status', dataIndex: 'status', render: statusTag },
  { title: 'Qty', dataIndex: 'quantity', align: 'right', render: qty },
  {
    title: 'Revenue',
    dataIndex: 'revenue',
    align: 'right',
    render: (v: number) => peso(v),
  },
  { title: 'Cost', dataIndex: 'cost', align: 'right', render: (v: number) => peso(v) },
  {
    title: 'Margin',
    dataIndex: 'margin',
    align: 'right',
    render: (v: number) => <strong>{peso(v)}</strong>,
  },
]

/** The items behind one invoice (per-invoice view). */
const itemEntryColumns: ColumnsType<InvoiceItemEntry> = [
  {
    title: 'Item',
    dataIndex: 'itemName',
    render: (name: string, r) => (
      <>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{itemSubLabel(r)}</div>
      </>
    ),
  },
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
    title: 'Revenue',
    dataIndex: 'revenue',
    align: 'right',
    render: (v: number) => peso(v),
  },
  { title: 'Cost', dataIndex: 'cost', align: 'right', render: (v: number) => peso(v) },
  {
    title: 'Margin',
    dataIndex: 'margin',
    align: 'right',
    render: (v: number) => <strong>{peso(v)}</strong>,
  },
]

/** Rows expanded under an item row (its invoices). */
const expandItem = {
  expandedRowRender: (r: ItemSalesRow) => (
    <Table<ItemSaleEntry>
      rowKey="invoiceId"
      columns={invoiceEntryColumns}
      dataSource={r.entries}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
    />
  ),
}

/** Rows expanded under an invoice row (its items + the document's own figures). */
const expandInvoice = {
  expandedRowRender: (r: InvoiceSalesRow) => (
    <>
      <Table<InvoiceItemEntry>
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
          Revenue (net): <strong>{peso(r.revenue)}</strong>
        </span>
        {r.discountAmount > 0 && <span>Discount: −{peso(r.discountAmount)}</span>}
        <span>Tax: {peso(r.taxAmount)}</span>
        <span>
          Invoiced total: <strong>{peso(r.total)}</strong>
        </span>
      </div>
    </>
  ),
}

function SalesBreakdownPage() {
  const [group, setGroup] = useState<Group>('item')
  const [split, setSplit] = useState<Split>('flat')
  const [period, setPeriod] = useState<Period>('all')
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null)
  // Row order as the table currently displays it, so the running total follows
  // whatever the user sorted by rather than the order the report shipped in.
  const [sortKeys, setSortKeys] = useState<string[] | null>(null)

  const filter = useMemo(() => rangeFor(period, custom), [period, custom])
  const flat = split === 'flat'
  const byItem = useGetSalesByItemQuery(filter, { skip: !flat || group !== 'item' })
  const byInvoice = useGetSalesByInvoiceQuery(filter, {
    skip: !flat || group !== 'invoice',
  })
  const monthlyByItem = useGetMonthlySalesByItemQuery(filter, {
    skip: flat || group !== 'item',
  })
  const monthlyByInvoice = useGetMonthlySalesByInvoiceQuery(filter, {
    skip: flat || group !== 'invoice',
  })

  const active = flat
    ? group === 'item'
      ? byItem
      : byInvoice
    : group === 'item'
      ? monthlyByItem
      : monthlyByInvoice
  const totals = active.data?.totals

  const flatRows: MoneyRow[] = useMemo(
    () => (flat ? ((byItem.data?.rows ?? byInvoice.data?.rows ?? []) as MoneyRow[]) : []),
    [flat, byItem.data, byInvoice.data],
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
    const totalRevenue = ordered.reduce((s, r) => s + r.revenue, 0)
    const map = new Map<string, Cumulative>()
    let revenue = 0
    let margin = 0
    for (const row of ordered) {
      revenue = round2(revenue + row.revenue)
      margin = round2(margin + row.margin)
      map.set(row.key, {
        revenue,
        margin,
        revenuePct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
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
   * Money columns shared by both groupings. The per-row running totals only
   * make sense in the flat view — in monthly mode they live in each month's
   * footer instead.
   */
  function moneyColumns<T extends MoneyRow>(withRunning: boolean): ColumnsType<T> {
    const cols: ColumnsType<T> = [
      {
        title: 'Revenue',
        dataIndex: 'revenue',
        align: 'right',
        sorter: (a, b) => a.revenue - b.revenue,
        render: (v: number) => <span style={{ fontWeight: 600 }}>{peso(v)}</span>,
      },
      {
        title: 'Cost (FIFO)',
        dataIndex: 'cost',
        align: 'right',
        sorter: (a, b) => a.cost - b.cost,
        render: (v: number) => peso(v),
      },
      {
        title: 'Margin',
        dataIndex: 'margin',
        align: 'right',
        sorter: (a, b) => a.margin - b.margin,
        render: (v: number) => (
          <span style={{ color: v < 0 ? 'var(--color-danger-text)' : undefined }}>
            {peso(v)}
          </span>
        ),
      },
      {
        title: 'Margin %',
        dataIndex: 'marginPct',
        align: 'right',
        sorter: (a, b) => a.marginPct - b.marginPct,
        render: (v: number) => (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(v)}</span>
        ),
      },
    ]
    if (!withRunning) return cols
    return [
      ...cols,
      {
        title: 'Cumulative revenue',
        key: 'cumulativeRevenue',
        align: 'right',
        render: (_, r) => {
          const c = cumulative.get(r.key)
          return runningCell(c?.revenue, c ? `${pct(c.revenuePct)} of period` : undefined)
        },
      },
      {
        title: 'Cumulative margin',
        key: 'cumulativeMargin',
        align: 'right',
        render: (_, r) => runningCell(cumulative.get(r.key)?.margin),
      },
    ]
  }

  const itemColumns = (withRunning: boolean): ColumnsType<ItemSalesRow> => [
    {
      title: 'Item',
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
      title: 'Qty sold',
      dataIndex: 'quantity',
      align: 'right',
      sorter: (a, b) => a.quantity - b.quantity,
      render: (v: number, r) => (
        <>
          {qty(v)} <span style={{ color: 'var(--text-muted)' }}>{r.unit}</span>
        </>
      ),
    },
    ...moneyColumns<ItemSalesRow>(withRunning),
    {
      title: 'Invoices',
      dataIndex: 'invoiceCount',
      align: 'right',
      sorter: (a, b) => a.invoiceCount - b.invoiceCount,
      render: qty,
    },
  ]

  const invoiceColumns = (withRunning: boolean): ColumnsType<InvoiceSalesRow> => [
    {
      title: 'Invoice',
      dataIndex: 'reference',
      render: (v: string, r) => (
        <>
          <span style={{ fontWeight: 600 }}>{v}</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {r.paymentTerm} · due {dayjs(r.dueDate).format('MMM D, YYYY')}
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
    { title: 'Customer', dataIndex: 'customerName', render: (v: string) => v || '—' },
    { title: 'Status', dataIndex: 'status', render: statusTag },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      align: 'right',
      sorter: (a, b) => a.quantity - b.quantity,
      render: qty,
    },
    ...moneyColumns<InvoiceSalesRow>(withRunning),
    {
      title: 'Items',
      dataIndex: 'itemCount',
      align: 'right',
      sorter: (a, b) => a.itemCount - b.itemCount,
      render: qty,
    },
  ]

  /**
   * One footer row of totals. `lead` is how many label columns precede the
   * numbers (the expand column is folded into the label cell); `running` adds
   * the two cumulative columns the flat view carries.
   */
  const totalsRow = (opts: {
    rowKey: string
    label: ReactNode
    totals: SalesBreakdownTotals
    lead: number
    trailing: number
    running?: boolean
    muted?: boolean
  }) => {
    const { totals: t, muted } = opts
    const rowClass = muted ? 'report-cumulative-row' : 'report-total-row'
    const value = (v: ReactNode) => <span className="report-figure">{v}</span>
    const cells: ReactNode[] = [
      <Table.Summary.Cell key="label" index={0} colSpan={opts.lead + 1}>
        <span className={`${rowClass}__label`}>{opts.label}</span>
      </Table.Summary.Cell>,
      <Table.Summary.Cell key="qty" index={1} align="right">
        {value(t.quantity.toLocaleString())}
      </Table.Summary.Cell>,
      <Table.Summary.Cell key="revenue" index={2} align="right">
        {value(peso(t.revenue))}
      </Table.Summary.Cell>,
      <Table.Summary.Cell key="cost" index={3} align="right">
        {value(peso(t.cost))}
      </Table.Summary.Cell>,
      <Table.Summary.Cell key="margin" index={4} align="right">
        {value(peso(t.margin))}
      </Table.Summary.Cell>,
      <Table.Summary.Cell key="marginPct" index={5} align="right">
        {value(pct(t.marginPct))}
      </Table.Summary.Cell>,
    ]
    if (opts.running) {
      // The per-row running totals land on the period totals by the last row.
      cells.push(
        <Table.Summary.Cell key="cumRevenue" index={6} align="right">
          {value(peso(t.revenue))}
        </Table.Summary.Cell>,
        <Table.Summary.Cell key="cumMargin" index={7} align="right">
          {value(peso(t.margin))}
        </Table.Summary.Cell>,
      )
    }
    cells.push(
      <Table.Summary.Cell
        key="trailing"
        index={8}
        colSpan={opts.trailing}
        align="right"
      />,
    )
    return (
      <Table.Summary.Row key={opts.rowKey} className={rowClass}>
        {cells}
      </Table.Summary.Row>
    )
  }

  const lead = group === 'item' ? 1 : 4

  /** Flat view footer: the period's totals. */
  const periodSummary = () =>
    totals
      ? () => (
          <Table.Summary fixed>
            {totalsRow({
              rowKey: 'period',
              label: `Total · ${totals.itemCount} items · ${totals.invoiceCount} invoices`,
              totals,
              lead,
              trailing: 1,
              running: true,
            })}
          </Table.Summary>
        )
      : undefined

  /** Monthly view footer: this month's totals, then everything up to it. */
  const monthSummary = (section: {
    label: string
    totals: SalesBreakdownTotals
    cumulative: SalesBreakdownTotals
  }) => (
    <Table.Summary fixed>
      {totalsRow({
        rowKey: 'month',
        label: `${section.label} total`,
        totals: section.totals,
        lead,
        trailing: 1,
      })}
      {totalsRow({
        rowKey: 'cumulative',
        label: `Cumulative through ${section.label}`,
        totals: section.cumulative,
        lead,
        trailing: 1,
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
        'No issued invoices in this period. Send an invoice to record a sale.',
    },
  }

  /**
   * Month sections stack tables, so each one paginates: a busy month must not
   * put hundreds of rows in the DOM. The footers stay month-wide — they read
   * the section's totals, not the visible page.
   */
  const monthTableProps = { ...tableProps, style: undefined }

  const sections = flat
    ? []
    : group === 'item'
      ? monthlyByItem.data?.sections ?? []
      : monthlyByInvoice.data?.sections ?? []

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Sales Breakdown</h1>
          <p>
            What was sold across issued invoices — revenue net of tax and
            discount, cost at FIFO. Expand a row to see the other side of the
            split.
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
              { value: 'invoice', label: 'By invoice' },
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
          icon={<PackageMinus size={20} />}
          label="Units sold"
          value={totals ? totals.quantity.toLocaleString() : '—'}
          tone="brand"
        />
        <StatCard
          icon={<Coins size={20} />}
          label="Revenue (net of tax)"
          value={totals ? peso(totals.revenue) : '—'}
          tone="green"
        />
        <StatCard
          icon={<Boxes size={20} />}
          label="Cost of goods sold"
          value={totals ? peso(totals.cost) : '—'}
          tone="warn"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label={totals ? `Gross margin · ${pct(totals.marginPct)}` : 'Gross margin'}
          value={totals ? peso(totals.margin) : '—'}
          tone="neutral"
        />
      </div>

      {/* ---- Flat: one continuous table with per-row running totals ---- */}
      {flat && group === 'item' && (
        <Table<ItemSalesRow>
          {...tableProps}
          rowKey="key"
          columns={itemColumns(true)}
          dataSource={byItem.data?.rows}
          loading={byItem.isFetching}
          onChange={(_p, _f, _s, extra) =>
            setSortKeys(extra.currentDataSource.map((r) => r.key))
          }
          expandable={expandItem}
          summary={periodSummary()}
        />
      )}
      {flat && group === 'invoice' && (
        <Table<InvoiceSalesRow>
          {...tableProps}
          rowKey="key"
          columns={invoiceColumns(true)}
          dataSource={byInvoice.data?.rows}
          loading={byInvoice.isFetching}
          onChange={(_p, _f, _s, extra) =>
            setSortKeys(extra.currentDataSource.map((r) => r.key))
          }
          expandable={expandInvoice}
          summary={periodSummary()}
        />
      )}

      {/* ---- Monthly: a section per month, each closing with its own
              total and the running total through that month ---- */}
      {!flat && sections.length === 0 && (
        <Table
          {...tableProps}
          rowKey="key"
          columns={
            (group === 'item'
              ? itemColumns(false)
              : invoiceColumns(false)) as ColumnsType<never>
          }
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
                {section.totals.invoiceCount} invoices · {section.totals.itemCount}{' '}
                items · {peso(section.totals.revenue)} revenue
              </span>
            </div>
            {group === 'item' ? (
              <Table<ItemSalesRow>
                {...monthTableProps}
                rowKey="key"
                columns={itemColumns(false)}
                dataSource={section.rows as ItemSalesRow[]}
                loading={monthlyByItem.isFetching}
                expandable={expandItem}
                summary={() => monthSummary(section)}
              />
            ) : (
              <Table<InvoiceSalesRow>
                {...monthTableProps}
                rowKey="key"
                columns={invoiceColumns(false)}
                dataSource={section.rows as InvoiceSalesRow[]}
                loading={monthlyByInvoice.isFetching}
                expandable={expandInvoice}
                summary={() => monthSummary(section)}
              />
            )}
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

export default SalesBreakdownPage
