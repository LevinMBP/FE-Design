import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Col, InputNumber, Row, Select, Table, Tag } from 'antd'
import { Plus, Trash2, X } from 'lucide-react'
import { useGetEmployeesQuery } from '../../contacts/contactsApi'
import {
  useGetLocationsQuery,
  useGetMaterialsQuery,
  useGetProductsQuery,
  useGetStockItemsQuery,
  useManufactureBatchMutation,
} from '../inventoryApi'
import type { Product, WorkerRef } from '../types'
import './ManufacturePage.css'

interface LineState {
  materialId: string | undefined
  quantity: number | null
  /** Set when the line came from the product's recipe — scales with output. */
  perUnit?: number
}

interface BlockState {
  productId: string | undefined
  outputQuantity: number | null
  lines: LineState[]
  sourceLocation: string | undefined
  destinationLocation: string | undefined
}

const ALL_LOCATIONS = 'All Locations'
const emptyLine = (): LineState => ({ materialId: undefined, quantity: null })
const money = (v: number) => `$${v.toFixed(2)}`

const linesFromRecipe = (p: Product | undefined, output: number | null): LineState[] => {
  if (!p?.recipe?.length) return [emptyLine()]
  return p.recipe.map((r) => ({
    materialId: r.materialId,
    perUnit: r.quantityPerUnit,
    quantity: r.quantityPerUnit * (output ?? 0),
  }))
}

const emptyBlock = (): BlockState => ({
  productId: undefined,
  outputQuantity: null,
  lines: [emptyLine()],
  sourceLocation: ALL_LOCATIONS,
  destinationLocation: undefined,
})

function ManufactureFormPage() {
  const navigate = useNavigate()
  const { data: products } = useGetProductsQuery()
  const { data: materials } = useGetMaterialsQuery()
  const { data: stockItems } = useGetStockItemsQuery()
  const { data: employees } = useGetEmployeesQuery()
  const { data: locations } = useGetLocationsQuery()
  const [manufactureBatch, { isLoading }] = useManufactureBatchMutation()

  const manufactured = useMemo(
    () => products?.filter((p) => p.type === 'manufactured') ?? [],
    [products],
  )
  const activeEmployees = useMemo(
    () => employees?.filter((e) => e.status === 'active') ?? [],
    [employees],
  )
  const locationOptions = useMemo(
    () =>
      (locations ?? [])
        .filter((l) => l.status === 'active')
        .map((l) => ({ value: l.name, label: l.code ? `${l.name} (${l.code})` : l.name })),
    [locations],
  )
  // Source can additionally be drawn from any location.
  const sourceOptions = useMemo(
    () => [{ value: ALL_LOCATIONS, label: 'All Locations' }, ...locationOptions],
    [locationOptions],
  )

  const [blocks, setBlocks] = useState<BlockState[]>([emptyBlock()])
  const [workerIds, setWorkerIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

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

  // Seed the first block with the first manufactured product + its recipe.
  useEffect(() => {
    if (manufactured.length === 0) return
    setBlocks((prev) => {
      if (prev.length !== 1 || prev[0].productId) return prev
      const first = manufactured[0]
      return [{ ...emptyBlock(), productId: first.id, lines: linesFromRecipe(first, null) }]
    })
  }, [manufactured])

  // Default any unset destination (where the product is stored) to the first location.
  useEffect(() => {
    if (locationOptions.length === 0) return
    setBlocks((prev) =>
      prev.some((b) => !b.destinationLocation)
        ? prev.map((b) =>
            b.destinationLocation ? b : { ...b, destinationLocation: locationOptions[0].value },
          )
        : prev,
    )
  }, [locationOptions])

  const patchBlock = (bi: number, next: (b: BlockState) => BlockState) =>
    setBlocks((prev) => prev.map((b, i) => (i === bi ? next(b) : b)))

  const onProductChange = (bi: number, id: string) => {
    const p = manufactured.find((x) => x.id === id)
    patchBlock(bi, (b) => ({ ...b, productId: id, lines: linesFromRecipe(p, b.outputQuantity) }))
    setError(null)
  }
  const onOutputChange = (bi: number, v: number | null) =>
    patchBlock(bi, (b) => ({
      ...b,
      outputQuantity: v,
      // Rescale recipe-derived lines; leave manual lines alone.
      lines: b.lines.map((l) => (l.perUnit != null ? { ...l, quantity: l.perUnit * (v ?? 0) } : l)),
    }))
  const setLineMaterial = (bi: number, li: number, materialId: string) =>
    patchBlock(bi, (b) => ({
      ...b,
      lines: b.lines.map((l, i) => (i === li ? { materialId, quantity: l.quantity, perUnit: undefined } : l)),
    }))
  const setLineQty = (bi: number, li: number, quantity: number | null) =>
    patchBlock(bi, (b) => ({
      ...b,
      lines: b.lines.map((l, i) => (i === li ? { ...l, quantity, perUnit: undefined } : l)),
    }))
  const addLine = (bi: number) => patchBlock(bi, (b) => ({ ...b, lines: [...b.lines, emptyLine()] }))
  const removeLine = (bi: number, li: number) =>
    patchBlock(bi, (b) => ({
      ...b,
      lines: b.lines.length === 1 ? b.lines : b.lines.filter((_, i) => i !== li),
    }))

  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock()])
  const removeBlock = (bi: number) =>
    setBlocks((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== bi)))

  // Aggregate material demand across every block — the basis for on-hand checks.
  const demandByMaterial = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of blocks) {
      for (const l of b.lines) {
        if (l.materialId && l.quantity && l.quantity > 0) {
          m.set(l.materialId, (m.get(l.materialId) ?? 0) + l.quantity)
        }
      }
    }
    return m
  }, [blocks])

  const isOver = (materialId: string | undefined) => {
    if (!materialId) return false
    const onHand = materialsById.get(materialId)?.quantity ?? 0
    return (demandByMaterial.get(materialId) ?? 0) > onHand
  }

  // Per-block cost figures for the summaries.
  const blockCost = (b: BlockState) => {
    const materialCost = b.lines.reduce((s, l) => {
      if (!l.materialId || !l.quantity || l.quantity <= 0) return s
      return s + l.quantity * (avgCostById.get(l.materialId) ?? 0)
    }, 0)
    const usable = b.lines.some((l) => l.materialId && l.quantity && l.quantity > 0)
    const unitCost = b.outputQuantity && b.outputQuantity > 0 ? materialCost / b.outputQuantity : 0
    return { materialCost, unitCost, usable }
  }

  const anyOver = [...demandByMaterial.keys()].some((id) => isOver(id))
  const totalMaterialCost = blocks.reduce((s, b) => s + blockCost(b).materialCost, 0)
  const blocksValid = blocks.every(
    (b) =>
      b.productId &&
      b.outputQuantity &&
      b.outputQuantity > 0 &&
      b.destinationLocation &&
      blockCost(b).usable,
  )
  const canProduce = blocksValid && !anyOver && !isLoading

  const handleProduce = async () => {
    setError(null)
    if (!canProduce) return
    const workers: WorkerRef[] = workerIds
      .map((id) => activeEmployees.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ id: e.id, name: e.name }))

    const items = blocks.map((b) => ({
      productId: b.productId as string,
      outputQuantity: b.outputQuantity as number,
      sourceLocation: b.sourceLocation,
      destinationLocation: b.destinationLocation,
      lines: b.lines
        .filter((l) => l.materialId && l.quantity && l.quantity > 0)
        .map((l) => ({ materialId: l.materialId as string, quantity: l.quantity as number })),
    }))

    try {
      await manufactureBatch({ workers, items }).unwrap()
      navigate('/inventory/manufacturing')
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Manufacturing failed.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New production</h1>
          <p>Consume materials to produce one or more finished products in a single run.</p>
        </div>
        <Button onClick={() => navigate('/inventory/manufacturing')}>Back to log</Button>
      </div>

      {error && (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} style={{ marginBottom: 18 }} />
      )}

      <div className="mfg">
        <div className="mfg__form">
          {blocks.map((block, bi) => {
            const selected = manufactured.find((p) => p.id === block.productId)
            const hasRecipe = !!selected?.recipe?.length
            const chosen = new Set(block.lines.map((l) => l.materialId).filter(Boolean))
            const { materialCost, unitCost } = blockCost(block)

            return (
              <div className="mfg__block" key={bi}>
                <div className="mfg__block-head">
                  <span className="mfg__block-title">Product {bi + 1}</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<Trash2 size={15} />}
                    onClick={() => removeBlock(bi)}
                    disabled={blocks.length === 1}
                    aria-label="Remove product"
                  />
                </div>

                <Row gutter={16}>
                  <Col span={14}>
                    <label className="mfg__label">Product to produce</label>
                    <Select
                      style={{ width: '100%' }}
                      value={block.productId}
                      onChange={(id) => onProductChange(bi, id)}
                      placeholder="Select product"
                      options={manufactured.map((p) => ({
                        value: p.id,
                        label: `${p.name} (in stock: ${p.quantity})`,
                      }))}
                    />
                  </Col>
                  <Col span={10}>
                    <label className="mfg__label">Output quantity</label>
                    <InputNumber
                      min={1}
                      style={{ width: '100%' }}
                      value={block.outputQuantity}
                      onChange={(v) => onOutputChange(bi, v)}
                      placeholder="0"
                    />
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={12}>
                    <label className="mfg__label">Inventory source</label>
                    <Select
                      style={{ width: '100%' }}
                      value={block.sourceLocation}
                      onChange={(v) => patchBlock(bi, (b) => ({ ...b, sourceLocation: v }))}
                      placeholder="Where materials come from"
                      options={sourceOptions}
                    />
                    <span className="mfg__hint">Where the materials are drawn from — pick “All Locations” to source from any.</span>
                  </Col>
                  <Col span={12}>
                    <label className="mfg__label">Inventory location</label>
                    <Select
                      style={{ width: '100%' }}
                      value={block.destinationLocation}
                      onChange={(v) => patchBlock(bi, (b) => ({ ...b, destinationLocation: v }))}
                      placeholder="Where the product is stored"
                      options={locationOptions}
                      notFoundContent="No active locations — add one under Locations."
                    />
                    <span className="mfg__hint">Where the finished product will be stored.</span>
                  </Col>
                </Row>

                <div className="mfg__lines-head">
                  <span className="mfg__label" style={{ margin: 0 }}>Materials to consume</span>
                  {hasRecipe && <Tag color="blue">From recipe</Tag>}
                </div>

                {block.lines.map((line, li) => {
                  const mat = line.materialId ? materialsById.get(line.materialId) : undefined
                  const onHand = mat?.quantity ?? 0
                  const needed = line.quantity ?? 0
                  const unitC = (line.materialId && avgCostById.get(line.materialId)) || 0
                  const over = isOver(line.materialId)
                  const options = materials
                    ?.filter((m) => m.id === line.materialId || !chosen.has(m.id))
                    .map((m) => ({ value: m.id, label: `${m.name} — ${m.quantity} ${m.unit} on hand` }))
                  return (
                    <div className="mfg__line-group" key={li}>
                      <div className="mfg__line">
                        <Select
                          style={{ flex: 1 }}
                          value={line.materialId}
                          onChange={(value) => setLineMaterial(bi, li, value)}
                          placeholder="Select material…"
                          status={over ? 'error' : undefined}
                          options={options}
                        />
                        <InputNumber
                          min={0}
                          className="mfg__line-qty"
                          value={line.quantity}
                          onChange={(value) => setLineQty(bi, li, value)}
                          placeholder="Qty"
                          status={over ? 'error' : undefined}
                        />
                        <Button
                          icon={<X size={16} />}
                          onClick={() => removeLine(bi, li)}
                          disabled={block.lines.length === 1}
                          aria-label="Remove material"
                        />
                      </div>
                      {line.materialId && (
                        <div className={`mfg__line-info ${over ? 'is-over' : ''}`}>
                          {over ? (
                            <span>
                              Batch needs {demandByMaterial.get(line.materialId)} {mat?.unit} but only {onHand} on hand
                            </span>
                          ) : (
                            <span>On hand {onHand} {mat?.unit}</span>
                          )}
                          <span className="mfg__line-cost">
                            {money(unitC)}/{mat?.unit} · {money(needed * unitC)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                <Button size="small" icon={<Plus size={15} />} onClick={() => addLine(bi)} className="mfg__add">
                  Add material
                </Button>

                <div className="mfg__block-cost">
                  <span>Material cost {money(materialCost)}</span>
                  <span>Cost per unit <strong>{money(unitCost)}</strong></span>
                </div>
              </div>
            )
          })}

          <Button icon={<Plus size={16} />} onClick={addBlock} className="mfg__add-block">
            Add another product
          </Button>

          <div style={{ marginTop: 20 }}>
            <label className="mfg__label">Workers (who produced this run)</label>
            <Select
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              value={workerIds}
              onChange={setWorkerIds}
              placeholder="Select worker(s)…"
              optionFilterProp="label"
              options={activeEmployees.map((e) => ({
                value: e.id,
                label: `${e.name}${e.position ? ` — ${e.position}` : ''}`,
              }))}
            />
          </div>

          <div className="mfg__summary">
            <div>
              <span className="mfg__summary-label">Products in run</span>
              <span className="mfg__summary-value">{blocks.length}</span>
            </div>
            <div>
              <span className="mfg__summary-label">Total material cost</span>
              <span className="mfg__summary-value">{money(totalMaterialCost)}</span>
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
              {
                title: 'Needed',
                align: 'right',
                render: (_: unknown, m) => {
                  const need = demandByMaterial.get(m.id) ?? 0
                  if (need === 0) return <span className="mfg__need-none">—</span>
                  const over = need > m.quantity
                  return <span className={over ? 'mfg__need-over' : 'mfg__need'}>{need}</span>
                },
              },
            ]}
            dataSource={materials}
            pagination={false}
          />
        </aside>
      </div>
    </div>
  )
}

export default ManufactureFormPage
