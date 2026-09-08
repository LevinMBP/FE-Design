import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DatePicker, Segmented, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Boxes, PackageMinus, PackagePlus, Warehouse } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useGetMonthlyStockByItemQuery,
  useGetMonthlyStockByLocationQuery,
  useGetMonthlyStockBySourceQuery,
  useGetStockByItemQuery,
  useGetStockByLocationQuery,
  useGetStockBySourceQuery,
} from '../inventoryApi'
import type {
  ItemFlowEntry,
  ItemStockRow,
  LocationStockRow,
  MovementEntry,
  SourceStockRow,
  StockBreakdownTotals,
} from '../stockBreakdown'
import '../../../shared/styles/report.css'

const { RangePicker } = DatePicker

/** Inventory screens price in dollars (see the currency drift in CLAUDE.md), but
    a report sums into the thousands, so the groups are kept. */
const money = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const num = (v: number) => (
  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>
)
const pct = (v: number) => `${v.toFixed(1)}%`
const signed = (v: number) => `${v > 0 ? '+' : ''}${money(v)}`
const round2 = (n: number) => Math.round(n * 100) / 100

const IN_COLOR = 'var(--color-success-text)'
const OUT_COLOR = 'var(--color-danger-text)'

/**
 * The report's unit of display: an amount of money over the quantity behind it.
 * Value leads because that is what ties to the books — and because quantities
 * across items are in mixed units, so only the money adds up.
 */
const stack = (value: ReactNode, sub: ReactNode, color?: string) => (
  <>
    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
      {value}
    </span>
    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
  </>
)

const flowCell = (qty: number, value: number, unit?: string, color?: string) =>
  stack(
    money(value),
    <>
      {num(qty)} {unit}
    </>,
    color,
  )

const netCell = (qty: number, value: number, unit?: string) =>
  stack(
    signed(value),
    <>
      {qty > 0 ? '+' : ''}
      {num(qty)} {unit}
    </>,
    value === 0 ? undefined : value > 0 ? IN_COLOR : OUT_COLOR,
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

type Group = 'item' | 'source' | 'location'
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

/** What all three groupings have in common: a key and the flow figures. */
interface FlowRow {
  key: string
  inQty: number
  inValue: number
  outQty: number
  outValue: number
  netQty: number
  netValue: number
  /** Item rows carry a unit; a source or a location spans many. */
  unit?: string
}

/** Running totals down the report, and the share of the period reached so far. */
interface Cumulative {
  inValue: number
  inPct: number
  outValue: number
}

/** The movements behind one item — its ledger, narrowed to the period. */
const movementColumns: ColumnsType<MovementEntry> = [
  {
    title: 'Date',
    dataIndex: 'date',
    render: (d: string) => dayjs(d).format('MMM D, YYYY'),
  },
  { title: 'Source', dataIndex: 'source' },
  {
    title: 'Reference',
    dataIndex: 'reference',
    render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Location',
    dataIndex: 'location',
    render: (v: string) => v || '—',
  },
  {
    title: 'In',
    key: 'in',
    align: 'right',
    render: (_, r) =>
      r.direction === 'in' ? (
        <span style={{ color: IN_COLOR }}>{num(r.quantity)}</span>
      ) : (
        '—'
      ),
  },
  {
    title: 'Out',
    key: 'out',
    align: 'right',
    render: (_, r) =>
      r.direction === 'out' ? (
        <span style={{ color: OUT_COLOR }}>{num(r.quantity)}</span>
      ) : (
        '—'
      ),
  },
  {
    title: 'Unit cost',
    dataIndex: 'unitCost',
    align: 'right',
    render: (v: number) => money(v),
  },
  { title: 'Value', dataIndex: 'value', align: 'right', render: (v: number) => money(v) },
  {
    title: 'Balance',
    dataIndex: 'balance',
    align: 'right',
    render: (v: number) => <strong>{num(v)}</strong>,
  },
  {
    title: 'Stock value',
    dataIndex: 'stockValue',
    align: 'right',
    render: (v: number) => money(v),
  },
]

/** The items behind one source or one location. */
const itemFlowColumns: ColumnsType<ItemFlowEntry> = [
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
    title: 'In',
    dataIndex: 'inValue',
    align: 'right',
    render: (_: number, r) => flowCell(r.inQty, r.inValue, r.unit, IN_COLOR),
  },
  {
    title: 'Out',
    dataIndex: 'outValue',
    align: 'right',
    render: (_: number, r) => flowCell(r.outQty, r.outValue, r.unit, OUT_COLOR),
  },
  {
    title: 'Net change',
    dataIndex: 'netValue',
    align: 'right',
    render: (_: number, r) => netCell(r.netQty, r.netValue, r.unit),
  },
  {
    title: 'Movements',
    dataIndex: 'movementCount',
    align: 'right',
    render: num,
  },
]

/** Rows expanded under an item row (the movements it made). */
const expandItem = {
  rowExpandable: (r: ItemStockRow) => r.entries.length > 0,
  expandedRowRender: (r: ItemStockRow) => (
    <Table<MovementEntry>
      rowKey="key"
      columns={movementColumns}
      dataSource={r.entries}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
    />
  ),
}

/** Rows expanded under a source or location row (the items it moved). */
const expandFlow = {
  expandedRowRender: (r: SourceStockRow | LocationStockRow) => (
    <Table<ItemFlowEntry>
      rowKey="key"
      columns={itemFlowColumns}
      dataSource={r.entries}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
    />
  ),
}

function StockBreakdownPage() {
  const [group, setGroup] = useState<Group>('item')
  const [split, setSplit] = useState<Split>('flat')
  const [period, setPeriod] = useState<Period>('all')
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null)
  // Row order as the table currently displays it, so the running total follows
  // whatever the user sorted by rather than the order the report shipped in.
  const [sortKeys, setSortKeys] = useState<string[] | null>(null)

  const filter = useMemo(() => rangeFor(period, custom), [period, custom])
  const flat = split === 'flat'
  const byItem = useGetStockByItemQuery(filter, { skip: !flat || group !== 'item' })
  const bySource = useGetStockBySourceQuery(filter, {
    skip: !flat || group !== 'source',
  })
  const byLocation = useGetStockByLocationQuery(filter, {
    skip: !flat || group !== 'location',
  })
  const monthlyByItem = useGetMonthlyStockByItemQuery(filter, {
    skip: flat || group !== 'item',
  })
  const monthlyBySource = useGetMonthlyStockBySourceQuery(filter, {
    skip: flat || group !== 'source',
  })
  const monthlyByLocation = useGetMonthlyStockByLocationQuery(filter, {
    skip: flat || group !== 'location',
  })

  const flatQuery =
    group === 'item' ? byItem : group === 'source' ? bySource : byLocation
  const monthlyQuery =
    group === 'item'
      ? monthlyByItem
      : group === 'source'
        ? monthlyBySource
        : monthlyByLocation
  const active = flat ? flatQuery : monthlyQuery
  const totals = active.data?.totals

  const flatRows: FlowRow[] = useMemo(
    () => (flat ? ((flatQuery.data?.rows ?? []) as FlowRow[]) : []),
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
    const periodIn = ordered.reduce((s, r) => s + r.inValue, 0)
    const map = new Map<string, Cumulative>()
    let inValue = 0
    let outValue = 0
    for (const row of ordered) {
      inValue = round2(inValue + row.inValue)
      outValue = round2(outValue + row.outValue)
      map.set(row.key, {
        inValue,
        outValue,
        inPct: periodIn > 0 ? (inValue / periodIn) * 100 : 0,
      })
    }
    return map
  }, [flatRows, sortKeys])

  /** A running total cell: the amount so far, with an optional share below. */
  const runningCell = (value: number | undefined, sub?: string) =>
    value == null ? '—' : stack(money(value), sub ?? '')

  /**
   * The flow columns every grouping shares. The per-row running totals only
   * make sense in the flat view — in monthly mode they live in each month's
   * footer instead.
   */
  function flowColumns<T extends FlowRow>(withRunning: boolean): ColumnsType<T> {
    const cols: ColumnsType<T> = [
      {
        title: 'In',
        dataIndex: 'inValue',
        align: 'right',
        sorter: (a, b) => a.inValue - b.inValue,
        render: (_: number, r) => flowCell(r.inQty, r.inValue, r.unit, IN_COLOR),
      },
      {
        title: 'Out',
        dataIndex: 'outValue',
        align: 'right',
        sorter: (a, b) => a.outValue - b.outValue,
        render: (_: number, r) => flowCell(r.outQty, r.outValue, r.unit, OUT_COLOR),
      },
      {
        title: 'Net change',
        dataIndex: 'netValue',
        align: 'right',
        sorter: (a, b) => a.netValue - b.netValue,
        render: (_: number, r) => netCell(r.netQty, r.netValue, r.unit),
      },
    ]
    if (!withRunning) return cols
    return [
      ...cols,
      {
        title: 'Cumulative in',
        key: 'cumulativeIn',
        align: 'right',
        render: (_, r) => {
          const c = cumulative.get(r.key)
          return runningCell(c?.inValue, c ? `${pct(c.inPct)} of period` : undefined)
        },
      },
      {
        title: 'Cumulative out',
        key: 'cumulativeOut',
        align: 'right',
        render: (_, r) => runningCell(cumulative.get(r.key)?.outValue),
      },
    ]
  }

  const itemColumns = (withRunning: boolean): ColumnsType<ItemStockRow> => [
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
      title: 'Opening',
      dataIndex: 'openingValue',
      align: 'right',
      sorter: (a, b) => a.openingValue - b.openingValue,
      render: (_: number, r) => flowCell(r.openingQty, r.openingValue, r.unit),
    },
    ...flowColumns<ItemStockRow>(withRunning),
    {
      title: 'Closing',
      dataIndex: 'closingValue',
      align: 'right',
      sorter: (a, b) => a.closingValue - b.closingValue,
      render: (_: number, r) => flowCell(r.closingQty, r.closingValue, r.unit),
    },
    {
      title: 'Movements',
      dataIndex: 'movementCount',
      align: 'right',
      sorter: (a, b) => a.movementCount - b.movementCount,
      render: num,
    },
  ]

  const sourceColumns = (withRunning: boolean): ColumnsType<SourceStockRow> => [
    {
      title: 'Source',
      dataIndex: 'source',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    ...flowColumns<SourceStockRow>(withRunning),
    {
      title: 'Items',
      dataIndex: 'itemCount',
      align: 'right',
      sorter: (a, b) => a.itemCount - b.itemCount,
      render: num,
    },
    {
      title: 'Movements',
      dataIndex: 'movementCount',
      align: 'right',
      sorter: (a, b) => a.movementCount - b.movementCount,
      render: num,
    },
  ]

  const locationColumns = (withRunning: boolean): ColumnsType<LocationStockRow> => [
    {
      title: 'Location',
      dataIndex: 'location',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v || '—'}</span>,
    },
    ...flowColumns<LocationStockRow>(withRunning),
    {
      title: 'Items',
      dataIndex: 'itemCount',
      align: 'right',
      sorter: (a, b) => a.itemCount - b.itemCount,
      render: num,
    },
    {
      title: 'Movements',
      dataIndex: 'movementCount',
      align: 'right',
      sorter: (a, b) => a.movementCount - b.movementCount,
      render: num,
    },
  ]

  /** Opening and closing belong to an item, never to a source or a location. */
  const withBalances = group === 'item'
  /** How many columns trail the figures (counts). */
  const trailing = withBalances ? 1 : 2

  /**
   * One footer row of totals. The figures line up with the columns above:
   * [opening], in, out, net, [cumulative pair], [closing].
   */
  const totalsRow = (opts: {
    rowKey: string
    label: ReactNode
    totals: StockBreakdownTotals
    running?: boolean
    muted?: boolean
  }) => {
    const { totals: t, muted } = opts
    const rowClass = muted ? 'report-cumulative-row' : 'report-total-row'
    const figures: ReactNode[] = []
    if (withBalances) figures.push(flowCell(t.openingQty, t.openingValue))
    figures.push(
      flowCell(t.inQty, t.inValue, '', IN_COLOR),
      flowCell(t.outQty, t.outValue, '', OUT_COLOR),
      netCell(t.netQty, t.netValue),
    )
    // The per-row running totals land on the period totals by the last row.
    if (opts.running) figures.push(money(t.inValue), money(t.outValue))
    if (withBalances) figures.push(flowCell(t.closingQty, t.closingValue))

    return (
      <Table.Summary.Row key={opts.rowKey} className={rowClass}>
        <Table.Summary.Cell index={0} colSpan={2}>
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

  /** Flat view footer: the period's roll-forward. */
  const periodSummary = () =>
    totals
      ? () => (
          <Table.Summary fixed>
            {totalsRow({
              rowKey: 'period',
              label: `Total · ${totals.itemCount} items · ${totals.movementCount} movements`,
              totals,
              running: true,
            })}
          </Table.Summary>
        )
      : undefined

  /** Monthly view footer: this month's totals, then everything up to it. */
  const monthSummary = (section: {
    label: string
    totals: StockBreakdownTotals
    cumulative: StockBreakdownTotals
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
      emptyText: 'No stock moved in this period.',
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
      onChange: (
        _p: unknown,
        _f: unknown,
        _s: unknown,
        extra: { currentDataSource: { key: string }[] },
      ) => setSortKeys(extra.currentDataSource.map((r) => r.key)),
    }
    if (group === 'item') {
      return (
        <Table<ItemStockRow>
          {...shared}
          columns={itemColumns(true)}
          dataSource={byItem.data?.rows}
          expandable={expandItem}
        />
      )
    }
    if (group === 'source') {
      return (
        <Table<SourceStockRow>
          {...shared}
          columns={sourceColumns(true)}
          dataSource={bySource.data?.rows}
          expandable={expandFlow}
        />
      )
    }
    return (
      <Table<LocationStockRow>
        {...shared}
        columns={locationColumns(true)}
        dataSource={byLocation.data?.rows}
        expandable={expandFlow}
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
        <Table<ItemStockRow>
          {...shared}
          columns={itemColumns(false)}
          dataSource={section.rows as ItemStockRow[]}
          expandable={expandItem}
        />
      )
    }
    if (group === 'source') {
      return (
        <Table<SourceStockRow>
          {...shared}
          columns={sourceColumns(false)}
          dataSource={section.rows as SourceStockRow[]}
          expandable={expandFlow}
        />
      )
    }
    return (
      <Table<LocationStockRow>
        {...shared}
        columns={locationColumns(false)}
        dataSource={section.rows as LocationStockRow[]}
        expandable={expandFlow}
      />
    )
  }

  const emptyColumns = (
    group === 'item'
      ? itemColumns(false)
      : group === 'source'
        ? sourceColumns(false)
        : locationColumns(false)
  ) as ColumnsType<never>

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Stock Movement Breakdown</h1>
          <p>
            Opening + in − out = closing, in units and at FIFO cost. Receipts
            are valued at their own lot cost, issues at the lots they consumed.
            Location rows report flow only — FIFO costing is company-wide.
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
              { value: 'source', label: 'By source' },
              { value: 'location', label: 'By location' },
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
          icon={<Boxes size={20} />}
          label="Opening value"
          value={totals ? money(totals.openingValue) : '—'}
          tone="neutral"
        />
        <StatCard
          icon={<PackagePlus size={20} />}
          label="Stock in (at cost)"
          value={totals ? money(totals.inValue) : '—'}
          tone="green"
        />
        <StatCard
          icon={<PackageMinus size={20} />}
          label="Stock out (FIFO)"
          value={totals ? money(totals.outValue) : '—'}
          tone="warn"
        />
        <StatCard
          icon={<Warehouse size={20} />}
          label={
            totals ? `Closing value · ${signed(totals.netValue)}` : 'Closing value'
          }
          value={totals ? money(totals.closingValue) : '—'}
          tone="brand"
        />
      </div>

      {/* ---- Flat: one continuous table with per-row running totals ---- */}
      {flat && flatTable()}

      {/* ---- Monthly: a section per month, each opening where the last
              closed and closing with its own running roll-forward ---- */}
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
                {section.totals.movementCount} movements ·{' '}
                {money(section.totals.inValue)} in · {money(section.totals.outValue)}{' '}
                out
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

export default StockBreakdownPage
