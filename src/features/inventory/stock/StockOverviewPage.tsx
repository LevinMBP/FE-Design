import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select, Table, Tabs, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useGetLocationsQuery, useGetStockItemsAtLocationQuery } from '../inventoryApi'
import type { StockItem, StockStatus } from '../types'

const STATUS_META: Record<StockStatus, { label: string; bar: string }> = {
  ok: { label: 'OK', bar: 'var(--color-success)' },
  low: { label: 'Low', bar: 'var(--color-warning)' },
  out: { label: 'Out', bar: 'var(--color-danger)' },
}

/**
 * On-hand is shown relative to the largest on-hand quantity in the table and
 * snapped to quarters (0 / 25 / 50 / 75 / 100) so the bars read as levels
 * rather than as exact measurements.
 */
function fillPercent(onHand: number, peak: number): number {
  if (onHand <= 0 || peak <= 0) return 0
  return Math.min(100, Math.ceil((onHand / peak) * 4) * 25)
}

function buildColumns(peak: number): ColumnsType<StockItem> {
  return [
    {
      title: 'Item',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_: string, item) => (
        <div>
          <div style={{ fontWeight: 600 }}>{item.name}</div>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
            {item.sku}
          </div>
        </div>
      ),
    },
    {
      title: 'On hand',
      dataIndex: 'onHand',
      width: 220,
      sorter: (a, b) => a.onHand - b.onHand,
      filters: (Object.keys(STATUS_META) as StockStatus[]).map((s) => ({
        text: STATUS_META[s].label,
        value: s,
      })),
      onFilter: (value, item) => item.status === value,
      render: (v: number, item) => {
        const meta = STATUS_META[item.status]
        const pct = fillPercent(v, peak)
        return (
          <Tooltip title={`${v.toLocaleString()} ${item.unit} — ${meta.label}`}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                  }}
                >
                  {v.toLocaleString()}{' '}
                  <span className="text-tertiary" style={{ fontWeight: 400 }}>
                    {item.unit}
                  </span>
                </span>
                <span style={{ color: meta.bar, fontWeight: 600 }}>{meta.label}</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.name} stock level`}
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--color-disabled-bg)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: meta.bar,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: 'Stock value',
      dataIndex: 'stockValue',
      align: 'right',
      sorter: (a, b) => a.stockValue - b.stockValue,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          $
          {v.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      title: 'Last order',
      dataIndex: 'lastOrder',
      align: 'right',
      sorter: (a, b) => (a.lastOrder ?? '').localeCompare(b.lastOrder ?? ''),
      render: (d: string | null) => <DateCell date={d} />,
    },
    {
      title: 'Last updated',
      dataIndex: 'lastUpdated',
      align: 'right',
      sorter: (a, b) => (a.lastUpdated ?? '').localeCompare(b.lastUpdated ?? ''),
      render: (d: string | null) => <DateCell date={d} />,
    },
  ]
}

/** A date, or a muted dash when the item has no such movement at this scope. */
function DateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-tertiary">—</span>
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}
    </span>
  )
}

/** One kind's table. Bars scale against the peak within this kind only, so a
 *  material measured in kg is never sized against a product counted in pieces. */
function StockTable({ items, isLoading }: { items: StockItem[]; isLoading: boolean }) {
  const navigate = useNavigate()

  const columns = useMemo(() => buildColumns(Math.max(0, ...items.map((i) => i.onHand))), [items])

  return (
    <Table<StockItem>
      rowKey="id"
      columns={columns}
      dataSource={items}
      loading={isLoading}
      pagination={{ pageSize: 12, hideOnSinglePage: true, showSizeChanger: true }}
      scroll={{ x: 'max-content' }}
      onRow={(item) => ({
        onClick: () => navigate(`/inventory/stock/${item.kind}/${item.id}`),
        style: { cursor: 'pointer' },
      })}
    />
  )
}

const ALL_LOCATIONS = null

function StockOverviewPage() {
  // null = every location combined. That is the default: the client sees the
  // whole company first and narrows down deliberately.
  const [locationId, setLocationId] = useState<string | null>(ALL_LOCATIONS)

  const { data: locations } = useGetLocationsQuery()
  const { data: items, isLoading } = useGetStockItemsAtLocationQuery(locationId)

  const { products, materials } = useMemo(
    () => ({
      products: (items ?? []).filter((i) => i.kind === 'product'),
      materials: (items ?? []).filter((i) => i.kind === 'material'),
    }),
    [items],
  )

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Stock Overview</h1>
          <p>
            {locationId
              ? 'On-hand quantities at the selected location.'
              : 'On-hand quantities across all locations.'}
          </p>
        </div>
        <Select<string | null>
          value={locationId}
          onChange={setLocationId}
          style={{ minWidth: 220 }}
          options={[
            { value: ALL_LOCATIONS, label: 'All locations' },
            ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
          ]}
        />
      </div>

      <Tabs
        defaultActiveKey="product"
        items={[
          {
            key: 'product',
            label: `Products${isLoading ? '' : ` (${products.length})`}`,
            children: <StockTable items={products} isLoading={isLoading} />,
          },
          {
            key: 'material',
            label: `Materials${isLoading ? '' : ` (${materials.length})`}`,
            children: <StockTable items={materials} isLoading={isLoading} />,
          },
        ]}
      />
    </div>
  )
}

export default StockOverviewPage
