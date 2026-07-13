import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Col, InputNumber, Row, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, X } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useGetManufactureRunsQuery,
  useGetMaterialsQuery,
  useGetProductsQuery,
  useGetStockItemsQuery,
  useManufactureMutation,
} from '../inventoryApi'
import type {
  ManufactureRun,
  ManufactureRunLine,
  Product,
} from '../types'
import './ManufacturePage.css'

interface LineState {
  materialId: string | undefined
  quantity: number | null
  /** Set when the line came from the product's recipe — scales with output. */
  perUnit?: number
}

const emptyLine = (): LineState => ({ materialId: undefined, quantity: null })
const money = (v: number) => `$${v.toFixed(2)}`

const runLineColumns: ColumnsType<ManufactureRunLine> = [
  { title: 'Material', dataIndex: 'materialName' },
  {
    title: 'Qty',
    dataIndex: 'quantity',
    align: 'right',
    render: (q: number, l) => `${q} ${l.unit}`,
  },
  { title: 'Unit cost', dataIndex: 'unitCost', align: 'right', render: money },
  { title: 'Cost', dataIndex: 'cost', align: 'right', render: (v: number) => <strong>{money(v)}</strong> },
]

const historyColumns: ColumnsType<ManufactureRun> = [
  {
    title: 'Date',
    dataIndex: 'date',
    render: (d: string) => dayjs(d).format('MMM D, YYYY HH:mm'),
  },
  { title: 'Product', dataIndex: 'productName' },
  { title: 'Output', dataIndex: 'outputQuantity', align: 'right' },
  { title: 'Material cost', dataIndex: 'materialCost', align: 'right', render: money },
  {
    title: 'Unit cost',
    dataIndex: 'unitCost',
    align: 'right',
    render: (v: number) => <strong>{money(v)}</strong>,
  },
]

function ManufacturePage() {
  const { data: products } = useGetProductsQuery()
  const { data: materials } = useGetMaterialsQuery()
  const { data: stockItems } = useGetStockItemsQuery()
  const { data: runs, isLoading: runsLoading } = useGetManufactureRunsQuery()
  const [manufacture, { isLoading }] = useManufactureMutation()

  const manufactured = useMemo(
    () => products?.filter((p) => p.type === 'manufactured') ?? [],
    [products],
  )

  const [productId, setProductId] = useState<string | undefined>(undefined)
  const [outputQuantity, setOutputQuantity] = useState<number | null>(null)
  const [lines, setLines] = useState<LineState[]>([emptyLine()])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Lookups: material on-hand/unit, and FIFO avg cost per material.
  const materialsById = useMemo(
    () => new Map(materials?.map((m) => [m.id, m])),
    [materials],
  )
  const avgCostById = useMemo(
    () =>
      new Map(
        stockItems
          ?.filter((s) => s.kind === 'material')
          .map((s) => [s.id, s.avgCost]),
      ),
    [stockItems],
  )

  const linesFromRecipe = (p: Product | undefined, output: number | null): LineState[] => {
    if (!p?.recipe?.length) return [emptyLine()]
    return p.recipe.map((r) => ({
      materialId: r.materialId,
      perUnit: r.quantityPerUnit,
      quantity: r.quantityPerUnit * (output ?? 0),
    }))
  }

  // Default to the first manufactured product (and load its recipe) on arrival.
  useEffect(() => {
    if (!productId && manufactured.length > 0) {
      const first = manufactured[0]
      setProductId(first.id)
      setLines(linesFromRecipe(first, null))
    }
  }, [productId, manufactured])

  const onProductChange = (id: string) => {
    setProductId(id)
    setLines(linesFromRecipe(manufactured.find((p) => p.id === id), outputQuantity))
    setError(null)
    setSuccess(null)
  }

  // Rescale recipe-derived lines when output changes; leave manual lines alone.
  const onOutputChange = (v: number | null) => {
    setOutputQuantity(v)
    setLines((prev) =>
      prev.map((l) =>
        l.perUnit != null ? { ...l, quantity: l.perUnit * (v ?? 0) } : l,
      ),
    )
  }

  const setLineMaterial = (index: number, materialId: string) =>
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { materialId, quantity: l.quantity, perUnit: undefined } : l)),
    )
  const setLineQty = (index: number, quantity: number | null) =>
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, quantity, perUnit: undefined } : l)),
    )
  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))

  const selectedProduct = manufactured.find((p) => p.id === productId)
  const hasRecipe = !!selectedProduct?.recipe?.length

  // Per-line derived figures for validation + cost.
  const chosen = new Set(lines.map((l) => l.materialId).filter(Boolean))
  const computed = lines.map((l) => {
    const mat = l.materialId ? materialsById.get(l.materialId) : undefined
    const onHand = mat?.quantity ?? 0
    const needed = l.quantity ?? 0
    const unitCost = (l.materialId && avgCostById.get(l.materialId)) || 0
    return {
      mat,
      onHand,
      needed,
      unitCost,
      lineCost: needed * unitCost,
      leftAfter: onHand - needed,
      over: !!l.materialId && needed > onHand,
    }
  })

  const usableCount = computed.filter((c, i) => lines[i].materialId && c.needed > 0).length
  const anyOver = computed.some((c) => c.over)
  const materialCost = computed.reduce(
    (s, c, i) => (lines[i].materialId && c.needed > 0 ? s + c.lineCost : s),
    0,
  )
  const perUnitCost =
    outputQuantity && outputQuantity > 0 ? materialCost / outputQuantity : 0

  const canProduce =
    !!productId && !!outputQuantity && outputQuantity > 0 && usableCount > 0 && !anyOver

  const handleProduce = async () => {
    setError(null)
    setSuccess(null)
    if (!canProduce || !productId || !outputQuantity) return

    const usable = lines
      .filter((l) => l.materialId && l.quantity && l.quantity > 0)
      .map((l) => ({ materialId: l.materialId as string, quantity: l.quantity as number }))

    try {
      const { product, run } = await manufacture({
        productId,
        outputQuantity,
        lines: usable,
      }).unwrap()
      setSuccess(
        `Produced ${outputQuantity} × ${product.name} at ${money(run.unitCost)}/unit ` +
          `(material cost ${money(run.materialCost)}). New stock: ${product.quantity}.`,
      )
      setOutputQuantity(null)
      setLines(linesFromRecipe(selectedProduct, null))
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Manufacturing failed.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Manufacturing</h1>
          <p>Consume materials to produce a finished product.</p>
        </div>
      </div>

      {error && (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} style={{ marginBottom: 18 }} />
      )}
      {success && (
        <Alert type="success" showIcon message={success} closable onClose={() => setSuccess(null)} style={{ marginBottom: 18 }} />
      )}

      <div className="mfg">
        <div className="form-shell mfg__form">
          <Row gutter={16}>
            <Col span={14}>
              <label className="mfg__label" htmlFor="product">Product to produce</label>
              <Select
                id="product"
                style={{ width: '100%' }}
                value={productId}
                onChange={onProductChange}
                placeholder="Select product"
                options={manufactured.map((p) => ({
                  value: p.id,
                  label: `${p.name} (in stock: ${p.quantity})`,
                }))}
              />
            </Col>
            <Col span={10}>
              <label className="mfg__label" htmlFor="output">Output quantity</label>
              <InputNumber
                id="output"
                min={1}
                style={{ width: '100%' }}
                value={outputQuantity}
                onChange={onOutputChange}
                placeholder="0"
              />
            </Col>
          </Row>

          <div className="mfg__lines-head">
            <span className="mfg__label" style={{ margin: 0 }}>Materials to consume</span>
            {hasRecipe && <Tag color="blue">From recipe</Tag>}
          </div>

          {lines.map((line, index) => {
            const c = computed[index]
            const options = materials
              ?.filter((m) => m.id === line.materialId || !chosen.has(m.id))
              .map((m) => ({ value: m.id, label: `${m.name} — ${m.quantity} ${m.unit} on hand` }))
            return (
              <div className="mfg__line-group" key={index}>
                <div className="mfg__line">
                  <Select
                    style={{ flex: 1 }}
                    value={line.materialId}
                    onChange={(value) => setLineMaterial(index, value)}
                    placeholder="Select material…"
                    status={c.over ? 'error' : undefined}
                    options={options}
                  />
                  <InputNumber
                    min={0}
                    className="mfg__line-qty"
                    value={line.quantity}
                    onChange={(value) => setLineQty(index, value)}
                    placeholder="Qty"
                    status={c.over ? 'error' : undefined}
                  />
                  <Button icon={<X size={16} />} onClick={() => removeLine(index)} disabled={lines.length === 1} aria-label="Remove material" />
                </div>
                {line.materialId && (
                  <div className={`mfg__line-info ${c.over ? 'is-over' : ''}`}>
                    {c.over ? (
                      <span>
                        Needs {c.needed} {c.mat?.unit} but only {c.onHand} on hand — short {c.needed - c.onHand}
                      </span>
                    ) : (
                      <span>
                        On hand {c.onHand} {c.mat?.unit} · left after {c.leftAfter} {c.mat?.unit}
                      </span>
                    )}
                    <span className="mfg__line-cost">
                      {money(c.unitCost)}/{c.mat?.unit} · {money(c.lineCost)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

          <Button size="small" icon={<Plus size={15} />} onClick={addLine} className="mfg__add">
            Add material
          </Button>

          <div className="mfg__summary">
            <div>
              <span className="mfg__summary-label">Total material cost</span>
              <span className="mfg__summary-value">{money(materialCost)}</span>
            </div>
            <div>
              <span className="mfg__summary-label">Cost per unit</span>
              <span className="mfg__summary-value">{money(perUnitCost)}</span>
            </div>
          </div>

          <div className="form-actions">
            <Button type="primary" onClick={handleProduce} loading={isLoading} disabled={!canProduce}>
              Produce
            </Button>
          </div>
        </div>

        <aside className="mfg__stock">
          <h2 className="mfg__stock-title">Materials on hand</h2>
          <Table
            rowKey="id"
            size="small"
            columns={[
              { title: 'Material', dataIndex: 'name' },
              {
                title: 'On hand',
                dataIndex: 'quantity',
                align: 'right',
                render: (_: number, m) => `${m.quantity} ${m.unit}`,
              },
            ]}
            dataSource={materials}
            pagination={false}
          />
        </aside>
      </div>

      <h2 className="mfg__history-title">Production history</h2>
      <Table<ManufactureRun>
        rowKey="id"
        columns={historyColumns}
        dataSource={runs}
        loading={runsLoading}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No production runs yet.' }}
        expandable={{
          expandedRowRender: (run) => (
            <Table<ManufactureRunLine>
              rowKey="materialId"
              size="small"
              columns={runLineColumns}
              dataSource={run.lines}
              pagination={false}
            />
          ),
        }}
      />
    </div>
  )
}

export default ManufacturePage
