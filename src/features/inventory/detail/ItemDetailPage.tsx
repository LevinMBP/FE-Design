import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton, Tag } from 'antd'
import { ArrowLeft, BookOpen, Layers, PackagePlus, Activity } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useGetItemLedgerQuery,
  useGetMaterialsQuery,
  useGetProductsQuery,
} from '../inventoryApi'
import { PRODUCT_TYPE_LABELS, type StockItemKind } from '../types'
import '../../../shared/styles/detail.css'

const money = (v: number) => `$${v.toFixed(2)}`
const num = (v: number) => v.toLocaleString()

const STATUS: Record<string, { label: string; color: string }> = {
  ok: { label: 'In stock', color: 'success' },
  low: { label: 'Low stock', color: 'warning' },
  out: { label: 'Out of stock', color: 'error' },
}

function ItemDetailPage({ kind }: { kind: StockItemKind }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: ledger, isLoading, isError } = useGetItemLedgerQuery({ kind, id })
  const { data: products } = useGetProductsQuery(undefined, { skip: kind !== 'product' })
  const { data: materials } = useGetMaterialsQuery()

  const listPath = kind === 'product' ? '/inventory/products' : '/inventory/materials'

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }
  if (isError || !ledger) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Not found</h1>
            <p>We couldn't find that item.</p>
          </div>
        </div>
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate(listPath)}>
          Back
        </Button>
      </div>
    )
  }

  const { item, layers, rows, stockValue, avgCost } = ledger
  const onHand = item.onHand
  const status = STATUS[item.status] ?? STATUS.ok

  const product = kind === 'product' ? products?.find((p) => p.id === id) : undefined
  const material = kind === 'material' ? materials?.find((m) => m.id === id) : undefined

  const typeLabel = product ? PRODUCT_TYPE_LABELS[product.type] : 'Raw material'
  const kicker = product ? `${typeLabel} product` : 'Raw material'
  const packaging = product?.packaging || material?.packaging || ''
  const price = product?.price
  const margin = price != null && avgCost > 0 ? price - avgCost : undefined
  const marginPct = margin != null && price ? Math.round((margin / price) * 100) : undefined

  const oldestLayer = layers[0]
  const recent = [...rows].reverse().slice(0, 6)

  // Bill of materials (manufactured products) with indicative build cost.
  const bom = (product?.recipe ?? []).map((r) => {
    const m = materials?.find((x) => x.id === r.materialId)
    return {
      name: m?.name ?? 'Material',
      unit: m?.unit ?? '',
      qty: r.quantityPerUnit,
      lineCost: (m?.unitCost ?? 0) * r.quantityPerUnit,
    }
  })
  const buildCost = bom.reduce((s, l) => s + l.lineCost, 0)

  // A little generated "story" paragraph from the record's data.
  const story = material
    ? `${material.name} is a raw material measured in ${material.unit}. ` +
      `There ${onHand === 1 ? 'is' : 'are'} currently ${num(onHand)} ${material.unit} on hand, ` +
      `carried at a weighted-average FIFO cost of ${money(avgCost)} for a total inventory value of ${money(stockValue)}. ` +
      `It reorders around ${num(material.minStock)} ${material.unit} and tops out near ${num(material.maxStock)} ${material.unit}.`
    : `${product?.name} is a ${typeLabel.toLowerCase()} product${packaging ? `, packed as ${packaging}` : ''}. ` +
      `There ${onHand === 1 ? 'is' : 'are'} ${num(onHand)} on hand valued at ${money(stockValue)} ` +
      `(average FIFO cost ${money(avgCost)})${price != null ? `, and it lists at ${money(price)}` : ''}.` +
      (bom.length ? ` Each unit is built from ${bom.length} raw material${bom.length > 1 ? 's' : ''}.` : '')

  const heroTone = product ? product.type : 'material'

  return (
    <div className="module-view">
      <Link to={listPath} className="idp__back">
        <ArrowLeft size={16} /> Back to {kind === 'product' ? 'products' : 'materials'}
      </Link>

      <article className="idp">
        <header className={`idp__hero idp__hero--${heroTone}`}>
          <div className="idp__avatar">{(item.name[0] ?? '?').toUpperCase()}</div>
          <div className="idp__kicker">{kicker}</div>
          <h1 className="idp__title">{item.name}</h1>
          <div className="idp__meta">
            <span className="idp__sku">{item.sku}</span>
            <span>·</span>
            <span>{item.unit}</span>
            {packaging && (
              <>
                <span>·</span>
                <span>{packaging}</span>
              </>
            )}
            <Tag color={status.color} style={{ marginInlineStart: 6 }}>
              {status.label}
            </Tag>
          </div>
        </header>

        <section className="idp__stats">
          <Stat label={`On hand (${item.unit})`} value={num(onHand)} />
          <Stat label="Stock value (FIFO)" value={money(stockValue)} />
          <Stat label="Avg cost" value={money(avgCost)} />
          {price != null ? (
            <Stat label="List price" value={money(price)} />
          ) : (
            <Stat label="Reorder at" value={`${num(material?.minStock ?? 0)} ${item.unit}`} />
          )}
        </section>

        {margin != null && (
          <p className="idp__margin">
            At the current cost, every unit sold earns a gross margin of{' '}
            <strong>{money(margin)}</strong>
            {marginPct != null && <> ({marginPct}%)</>}.
          </p>
        )}

        <section className="idp__section">
          <h2><BookOpen size={17} /> Overview</h2>
          <p className="idp__story">{story}</p>
          {item.status === 'out' && (
            <div className="idp__banner idp__banner--error">
              Out of stock — there's nothing on hand right now.
            </div>
          )}
          {item.status === 'low' && material && (
            <div className="idp__banner idp__banner--warn">
              Running low — {num(Math.max(0, material.minStock - onHand))} {item.unit} below the
              minimum of {num(material.minStock)}.
            </div>
          )}
        </section>

        {material && material.maxStock > 0 && (
          <section className="idp__section">
            <h2><Activity size={17} /> Stock level</h2>
            <div className="idp__meter">
              <div
                className={`idp__meter-fill idp__meter-fill--${item.status}`}
                style={{ width: `${Math.min(100, (onHand / material.maxStock) * 100)}%` }}
              />
              <span
                className="idp__meter-min"
                style={{ left: `${Math.min(100, (material.minStock / material.maxStock) * 100)}%` }}
                title={`Minimum ${material.minStock}`}
              />
            </div>
            <div className="idp__meter-legend">
              <span>0</span>
              <span>min {num(material.minStock)}</span>
              <span>max {num(material.maxStock)}</span>
            </div>
          </section>
        )}

        {bom.length > 0 && (
          <section className="idp__section">
            <h2><Layers size={17} /> Bill of materials</h2>
            <p className="idp__hint">Raw materials consumed to build one unit.</p>
            <div className="idp__list">
              {bom.map((l, i) => (
                <div key={i} className="idp__list-row">
                  <span className="idp__list-main">{l.name}</span>
                  <span className="idp__list-sub">
                    {l.qty} {l.unit} / unit
                  </span>
                  <span className="idp__list-amt">{money(l.lineCost)}</span>
                </div>
              ))}
              <div className="idp__list-row idp__list-row--total">
                <span className="idp__list-main">Indicative build cost / unit</span>
                <span className="idp__list-sub" />
                <span className="idp__list-amt">{money(buildCost)}</span>
              </div>
            </div>
          </section>
        )}

        <section className="idp__section">
          <h2><Layers size={17} /> Cost layers (FIFO)</h2>
          {layers.length === 0 ? (
            <p className="idp__hint">No stock on hand — no open cost layers.</p>
          ) : (
            <>
              <p className="idp__hint">
                {layers.length} open layer{layers.length > 1 ? 's' : ''}
                {oldestLayer && <> · oldest received {dayjs(oldestLayer.date).format('MMM D, YYYY')}</>}.
                The oldest is consumed first.
              </p>
              <div className="idp__list">
                {layers.map((l, i) => (
                  <div key={i} className="idp__list-row">
                    <span className="idp__list-main">{l.reference}</span>
                    <span className="idp__list-sub">
                      {num(l.quantity)} {item.unit} @ {money(l.unitCost)}
                    </span>
                    <span className="idp__list-amt">{money(l.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="idp__section">
          <h2><Activity size={17} /> Recent activity</h2>
          {recent.length === 0 ? (
            <p className="idp__hint">No movements yet.</p>
          ) : (
            <div className="idp__list">
              {recent.map((r) => (
                <div key={r.id} className="idp__list-row">
                  <span className="idp__list-main">
                    {r.source}
                    <span className="idp__list-ref"> {r.reference}</span>
                  </span>
                  <span className="idp__list-sub">{dayjs(r.date).format('MMM D, YYYY')}</span>
                  <span
                    className={`idp__list-amt ${r.direction === 'in' ? 'is-in' : 'is-out'}`}
                  >
                    {r.direction === 'in' ? '+' : '−'}
                    {num(r.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="idp__actions">
          <Link to={`/inventory/stock/${kind}/${id}`}>
            <Button type="primary" icon={<BookOpen size={16} />}>
              Open full ledger
            </Button>
          </Link>
          {onHand === 0 && (
            <Link to="/inventory/opening-balances">
              <Button icon={<PackagePlus size={16} />}>Add opening balance</Button>
            </Link>
          )}
        </div>
      </article>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="idp__stat">
      <div className="idp__stat-value">{value}</div>
      <div className="idp__stat-label">{label}</div>
    </div>
  )
}

export default ItemDetailPage
