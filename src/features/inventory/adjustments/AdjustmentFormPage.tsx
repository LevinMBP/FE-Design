import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useAddAdjustmentMutation,
  useGetAuditsQuery,
  useGetLocationsQuery,
  useGetStockItemsQuery,
} from '../inventoryApi'
import {
  ADJUSTMENT_REASON_OPTIONS,
  type AdjustmentReason,
  type NewAdjustmentLine,
  type StockItemKind,
} from '../types'
import '../audits/audits.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

type AdjustmentDirection = 'minus' | 'add'

interface LineValues {
  itemId?: string
  adjustmentType?: AdjustmentDirection
  quantity?: number
}

interface FormValues {
  date: Dayjs
  itemType: StockItemKind
  locationId: string
  reason: AdjustmentReason
  otherReason?: string
  lines: LineValues[]
}

const ITEM_TYPE_OPTIONS = [
  { value: 'material', label: 'Material' },
  { value: 'product', label: 'Product' },
]

/** Signed on-hand change of a line: additions positive, deductions negative. */
const lineDelta = (l: LineValues | undefined): number | null => {
  if (!l?.itemId || l.quantity == null || l.quantity <= 0) return null
  return l.adjustmentType === 'add' ? l.quantity : -l.quantity
}

/**
 * Post a stock adjustment — the only path (outside purchases/sales) that changes
 * on-hand. The document's item type (material/product) scopes every line, so the
 * backend never has to guess what an item id refers to. Each line applies a
 * signed amount (addition or deduction) against the current system on-hand —
 * before/after quantities are derived live — and the net value is booked to the
 * Inventory Adjustments account. When opened with `?audit=<id>` it fast-tracks
 * an audit: item type, location, reason and the variance deltas are pre-filled.
 */
function AdjustmentFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const auditId = params.get('audit') ?? undefined
  const [form] = Form.useForm<FormValues>()
  const { data: stockItems, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: locations } = useGetLocationsQuery()
  const { data: audits } = useGetAuditsQuery(undefined, { skip: !auditId })
  const [addAdjustment, { isLoading }] = useAddAdjustmentMutation()
  const lineValues = Form.useWatch('lines', form) ?? []
  const itemType: StockItemKind = Form.useWatch('itemType', form) ?? 'material'
  const reason: AdjustmentReason | undefined = Form.useWatch('reason', form)

  const audit = auditId ? audits?.find((a) => a.id === auditId) : undefined

  const locationOptions = (locations ?? [])
    .filter((l) => l.status === 'active')
    .map((l) => ({ value: l.id, label: l.code ? `${l.name} (${l.code})` : l.name }))

  useEffect(() => {
    if (!form.getFieldValue('locationId') && locationOptions.length > 0) {
      form.setFieldValue('locationId', locationOptions[0].value)
    }
  }, [form, locationOptions])

  // Picker restricted to the document's item type, plus on-hand/unit/avg cost.
  const { itemOptions, byId } = useMemo(() => {
    const byId = new Map<string, { onHand: number; unit: string; avgCost: number }>()
    const itemOptions = (stockItems ?? [])
      .filter((s) => s.kind === itemType)
      .map((s) => {
        byId.set(s.id, { onHand: s.onHand, unit: s.unit, avgCost: s.avgCost })
        return { value: s.id, label: `${s.name} (${s.sku})` }
      })
    return { itemOptions, byId }
  }, [stockItems, itemType])

  // Fast-track: pre-fill from the audit's variance lines once it has loaded.
  useEffect(() => {
    if (!audit) return
    const varianceLines = audit.lines.filter((l) => Math.abs(l.variance) > 0.0005)
    if (varianceLines.length === 0) return
    form.setFieldsValue({
      itemType: audit.itemType,
      locationId: audit.locationId,
      reason: 'count_correction',
      lines: varianceLines.map((l) => ({
        itemId: l.itemId,
        adjustmentType: l.variance > 0 ? 'add' : 'minus',
        quantity: Math.abs(l.variance),
      })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit])

  // Live net inventory value change (estimate — posting values at exact FIFO).
  const netEstimate = lineValues.reduce((sum, l) => {
    const delta = lineDelta(l)
    const meta = l?.itemId ? byId.get(l.itemId) : undefined
    if (delta == null || !meta) return sum
    return sum + delta * meta.avgCost
  }, 0)

  const onFinish = async (values: FormValues) => {
    const lines: NewAdjustmentLine[] = []
    for (const l of values.lines ?? []) {
      const delta = lineDelta(l)
      if (!l?.itemId || delta == null) continue
      lines.push({ itemId: l.itemId, delta })
    }
    if (lines.length === 0) {
      message.error('Add at least one item with an adjustment amount.')
      return
    }

    try {
      const adj = await addAdjustment({
        date: values.date.format('YYYY-MM-DD'),
        itemType: values.itemType,
        locationId: values.locationId,
        reason: values.reason,
        otherReason: values.reason === 'other' ? values.otherReason : undefined,
        note: audit ? `Reconciling audit ${audit.reference}` : '',
        auditId,
        lines,
      }).unwrap()
      message.success(
        `Adjustment ${adj.reference} posted — net ${peso(adj.netValue)} to inventory.`,
      )
      navigate('/inventory/adjustments')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Adjustment failed.')
    }
  }

  const netClass = netEstimate > 0.005 ? 'adj-net--up' : netEstimate < -0.005 ? 'adj-net--down' : ''

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New adjustment</h1>
          <p>
            Correct on-hand for a recount, damage, shrinkage or found stock.
            Enter how much to add or deduct per item; we apply the change and
            book the value to Inventory Adjustments.
          </p>
        </div>
      </div>

      {audit && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, maxWidth: 760 }}
          message={`Fast-tracked from audit ${audit.reference}`}
          description="The variance lines are pre-filled as additions/deductions. Posting will mark the audit as adjusted."
        />
      )}

      <div className="form-shell" style={{ maxWidth: 760 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            date: dayjs(),
            itemType: 'material',
            reason: 'count_correction',
            lines: [{ adjustmentType: 'minus' }],
          }}
          onFinish={onFinish}
        >
          <div className="form-section">
            <div className="form-section__title">Adjustment details</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="date"
                  label="Date"
                  rules={[{ required: true, message: 'Date is required' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="locationId"
                  label="Inventory location"
                  tooltip="Location the adjusted stock belongs to"
                  rules={[{ required: true, message: 'Pick a location' }]}
                >
                  <Select
                    placeholder="Where stock is adjusted"
                    options={locationOptions}
                    notFoundContent="No active locations — add one under Locations."
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="itemType"
                  label="Item type"
                  tooltip="What this adjustment covers — the item list below follows it"
                  rules={[{ required: true }]}
                  style={{ marginBottom: reason === 'other' ? undefined : 0 }}
                >
                  <Select
                    options={ITEM_TYPE_OPTIONS}
                    onChange={() => form.setFieldValue('lines', [{ adjustmentType: 'minus' }])}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="reason"
                  label="Reason"
                  rules={[{ required: true, message: 'Pick a reason' }]}
                  style={{ marginBottom: reason === 'other' ? undefined : 0 }}
                >
                  <Select options={ADJUSTMENT_REASON_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>

            {reason === 'other' && (
              <Form.Item
                name="otherReason"
                label="Other reason"
                rules={[{ required: true, message: 'Describe the reason' }]}
                style={{ marginBottom: 0 }}
              >
                <Input.TextArea rows={2} placeholder="What prompted this adjustment?" />
              </Form.Item>
            )}
          </div>

          <div className="form-section__title">Adjustment items</div>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => {
                  const line = lineValues[name]
                  const meta = line?.itemId ? byId.get(line.itemId) : undefined
                  const delta = lineDelta(line)
                  const after =
                    meta && delta != null
                      ? Math.round((meta.onHand + delta) * 100) / 100
                      : null
                  return (
                    <div key={key} className="line-card line-card--row">
                      <Row gutter={12} align="top">
                        <Col flex="auto">
                          <Form.Item
                            {...rest}
                            name={[name, 'itemId']}
                            style={{ marginBottom: 8 }}
                            rules={[{ required: true, message: 'Select an item' }]}
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              placeholder={itemType === 'material' ? 'Material' : 'Product'}
                              loading={itemsLoading}
                              options={itemOptions}
                            />
                          </Form.Item>
                        </Col>
                        <Col flex="32px">
                          <Button
                            type="text"
                            danger
                            aria-label="Remove item"
                            icon={<Trash2 size={16} />}
                            disabled={fields.length === 1}
                            onClick={() => remove(name)}
                          />
                        </Col>
                      </Row>
                      <Row gutter={12} align="top">
                        <Col>
                          <Form.Item
                            {...rest}
                            name={[name, 'adjustmentType']}
                            label="Adjustment type"
                            style={{ marginBottom: 0 }}
                            rules={[{ required: true }]}
                          >
                            <Radio.Group
                              optionType="button"
                              buttonStyle="solid"
                              options={[
                                { value: 'minus', label: 'Deduction' },
                                { value: 'add', label: 'Addition' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col flex="130px">
                          <Form.Item
                            {...rest}
                            name={[name, 'quantity']}
                            label="Amount"
                            style={{ marginBottom: 0 }}
                            rules={[
                              { required: true, message: 'Amount' },
                              {
                                validator: (_, v) => {
                                  if (v == null) return Promise.resolve()
                                  if (v <= 0) {
                                    return Promise.reject(new Error('Must be above zero'))
                                  }
                                  const cur = form.getFieldValue(['lines', name]) as
                                    | LineValues
                                    | undefined
                                  const m = cur?.itemId ? byId.get(cur.itemId) : undefined
                                  if (m && cur?.adjustmentType !== 'add' && v > m.onHand) {
                                    return Promise.reject(
                                      new Error(`Only ${m.onHand} on hand`),
                                    )
                                  }
                                  return Promise.resolve()
                                },
                              },
                            ]}
                          >
                            <InputNumber min={0} placeholder="Qty" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col flex="auto">
                          {/* Offset past the sibling labels so it sits level with the inputs. */}
                          <div className="audit-line-meta" style={{ textAlign: 'right', paddingTop: 37 }}>
                            {meta ? (
                              <span>
                                Before: <strong>{meta.onHand}</strong> {meta.unit}
                                {' → '}
                                After:{' '}
                                <strong>{after != null ? after : '—'}</strong> {meta.unit}
                                {delta != null && (
                                  <span style={{ marginInlineStart: 8 }}>
                                    (≈{peso(delta * meta.avgCost)})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span>Pick an item to see its on-hand quantity.</span>
                            )}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  )
                })}
                <Button
                  type="dashed"
                  onClick={() => add({ adjustmentType: 'minus' })}
                  icon={<Plus size={16} />}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Add item
                </Button>
              </>
            )}
          </Form.List>

          <div className={`form-totals ${netClass}`}>
            <div className="form-totals__row is-total">
              <span>Estimated net change</span>
              <strong>{peso(netEstimate)}</strong>
            </div>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Post adjustment
            </Button>
            <Button onClick={() => navigate('/inventory/adjustments')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default AdjustmentFormPage
