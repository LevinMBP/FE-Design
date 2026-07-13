import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Tag,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useAddAdjustmentMutation,
  useGetAuditsQuery,
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

interface LineValues {
  item?: string // "kind:id"
  countedQty?: number
}

interface FormValues {
  date: Dayjs
  reason: AdjustmentReason
  note: string
  lines: LineValues[]
}

/**
 * Post a stock adjustment — the only path (outside purchases/sales) that changes
 * on-hand. Each line targets a counted quantity; the delta against the current
 * system on-hand is applied as a movement and the net value is booked to the
 * Inventory Adjustments account. When opened with `?audit=<id>` it fast-tracks
 * an audit: the reason, note and variance lines are pre-filled.
 */
function AdjustmentFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const auditId = params.get('audit') ?? undefined
  const [form] = Form.useForm<FormValues>()
  const { data: stockItems, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: audits } = useGetAuditsQuery(undefined, { skip: !auditId })
  const [addAdjustment, { isLoading }] = useAddAdjustmentMutation()
  const lineValues = Form.useWatch('lines', form) ?? []

  const audit = auditId ? audits?.find((a) => a.id === auditId) : undefined

  // Combined picker keyed by "kind:id", plus lookups for on-hand/unit/avg cost.
  const { itemOptions, byKey } = useMemo(() => {
    const byKey = new Map<string, { onHand: number; unit: string; avgCost: number }>()
    const itemOptions = (stockItems ?? []).map((s) => {
      const value = `${s.kind}:${s.id}`
      byKey.set(value, { onHand: s.onHand, unit: s.unit, avgCost: s.avgCost })
      return { value, label: `${s.name} (${s.sku}) · ${s.kind}` }
    })
    return { itemOptions, byKey }
  }, [stockItems])

  // Fast-track: pre-fill from the audit's variance lines once it has loaded.
  useEffect(() => {
    if (!audit) return
    const varianceLines = audit.lines.filter((l) => Math.abs(l.variance) > 0.0005)
    if (varianceLines.length === 0) return
    form.setFieldsValue({
      reason: 'count',
      note: `Reconciling audit ${audit.reference}`,
      lines: varianceLines.map((l) => ({
        item: `${l.kind}:${l.itemId}`,
        countedQty: l.countedQty,
      })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit])

  // Live net inventory value change (estimate — posting values at exact FIFO).
  const netEstimate = lineValues.reduce((sum, l) => {
    const meta = l?.item ? byKey.get(l.item) : undefined
    if (!meta || l?.countedQty == null) return sum
    const delta = l.countedQty - meta.onHand
    return sum + delta * meta.avgCost
  }, 0)

  const onFinish = async (values: FormValues) => {
    const lines: NewAdjustmentLine[] = []
    for (const l of values.lines ?? []) {
      if (!l?.item || l.countedQty == null) continue
      const [kind, id] = l.item.split(':')
      lines.push({ kind: kind as StockItemKind, itemId: id, countedQty: l.countedQty })
    }
    if (lines.length === 0) {
      message.error('Add at least one item with a counted quantity.')
      return
    }

    try {
      const adj = await addAdjustment({
        date: values.date.format('YYYY-MM-DD'),
        reason: values.reason,
        note: values.note ?? '',
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
            Correct on-hand for a recount, damage, loss or found stock. Enter the
            quantity that should be on hand; we apply the difference and book the
            value to Inventory Adjustments.
          </p>
        </div>
      </div>

      {audit && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, maxWidth: 760 }}
          message={`Fast-tracked from audit ${audit.reference}`}
          description="The variance lines are pre-filled with the counted quantities. Posting will mark the audit as adjusted."
        />
      )}

      <div className="form-shell" style={{ maxWidth: 760 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ date: dayjs(), reason: 'count', note: '', lines: [{}] }}
          onFinish={onFinish}
        >
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
                name="reason"
                label="Reason"
                rules={[{ required: true, message: 'Pick a reason' }]}
              >
                <Select options={ADJUSTMENT_REASON_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} placeholder="Optional — context for this adjustment" />
          </Form.Item>

          <Divider style={{ margin: '4px 0 16px' }}>Items</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => {
                  const selected = lineValues[name]?.item
                  const meta = selected ? byKey.get(selected) : undefined
                  const counted = lineValues[name]?.countedQty
                  const delta =
                    meta && counted != null
                      ? Math.round((counted - meta.onHand) * 100) / 100
                      : null
                  return (
                    <Row key={key} gutter={12} align="top" style={{ marginBottom: 8 }}>
                      <Col flex="auto">
                        <Form.Item
                          {...rest}
                          name={[name, 'item']}
                          style={{ marginBottom: 0 }}
                          rules={[{ required: true, message: 'Select an item' }]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="Material or product"
                            loading={itemsLoading}
                            options={itemOptions}
                          />
                        </Form.Item>
                        <div className="audit-line-meta">
                          {meta ? (
                            <>
                              <span>On hand: <strong>{meta.onHand}</strong> {meta.unit}</span>
                              {delta != null && delta !== 0 && (
                                <Tag color={delta > 0 ? 'success' : 'error'} style={{ marginInlineStart: 8 }}>
                                  {delta > 0 ? `+${delta}` : delta} · ≈{peso(delta * meta.avgCost)}
                                </Tag>
                              )}
                              {delta === 0 && (
                                <Tag style={{ marginInlineStart: 8 }}>no change</Tag>
                              )}
                            </>
                          ) : (
                            <span>Pick an item to see its on-hand quantity.</span>
                          )}
                        </div>
                      </Col>
                      <Col flex="150px">
                        <Form.Item
                          {...rest}
                          name={[name, 'countedQty']}
                          style={{ marginBottom: 0 }}
                          rules={[
                            { required: true, message: 'New qty' },
                            {
                              validator: (_, v) =>
                                v == null || v >= 0
                                  ? Promise.resolve()
                                  : Promise.reject(new Error('Cannot be negative')),
                            },
                          ]}
                        >
                          <InputNumber
                            min={0}
                            placeholder="New on-hand"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col flex="32px">
                        <Button
                          aria-label="Remove item"
                          icon={<Trash2 size={16} />}
                          disabled={fields.length === 1}
                          onClick={() => remove(name)}
                          danger
                          shape="circle"
                        />
                      </Col>
                    </Row>
                  )
                })}
                <Button
                  type="dashed"
                  onClick={() => add({})}
                  icon={<Plus size={16} />}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Add item
                </Button>
              </>
            )}
          </Form.List>

          <div className={`adj-net ${netClass}`}>
            <span style={{ color: 'var(--text-muted)' }}>Estimated net change</span>
            <strong>{peso(netEstimate)}</strong>
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
