import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
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
  useAddAuditMutation,
  useGetLocationsQuery,
  useGetStockItemsQuery,
} from '../inventoryApi'
import type { NewAuditLine, StockItemKind } from '../types'
import './audits.css'

interface LineValues {
  item?: string // "kind:id"
  countedQty?: number
}

interface FormValues {
  date: Dayjs
  location: string
  note: string
  lines: LineValues[]
}

/**
 * Record a physical stock count. Each line snapshots the item's current system
 * on-hand and captures what was counted; the variance is shown live. Saving
 * stores the audit but changes NO stock — reconciling a variance is a separate
 * Adjustment (which can be fast-tracked from the audit afterwards).
 */
function AuditFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const { data: stockItems, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: locations } = useGetLocationsQuery()
  const [addAudit, { isLoading }] = useAddAuditMutation()
  const lineValues = Form.useWatch('lines', form) ?? []

  const locationOptions = (locations ?? [])
    .filter((l) => l.status === 'active')
    .map((l) => ({ value: l.name, label: l.code ? `${l.name} (${l.code})` : l.name }))

  useEffect(() => {
    if (!form.getFieldValue('location') && locationOptions.length > 0) {
      form.setFieldValue('location', locationOptions[0].value)
    }
  }, [form, locationOptions])

  // Combined picker keyed by "kind:id", plus lookups for on-hand and unit.
  const { itemOptions, byKey } = useMemo(() => {
    const byKey = new Map<string, { onHand: number; unit: string }>()
    const itemOptions = (stockItems ?? []).map((s) => {
      const value = `${s.kind}:${s.id}`
      byKey.set(value, { onHand: s.onHand, unit: s.unit })
      return { value, label: `${s.name} (${s.sku}) · ${s.kind}` }
    })
    return { itemOptions, byKey }
  }, [stockItems])

  const onFinish = async (values: FormValues) => {
    const lines: NewAuditLine[] = []
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
      const audit = await addAudit({
        date: values.date.format('YYYY-MM-DD'),
        location: values.location?.trim() || '—',
        note: values.note ?? '',
        lines,
      }).unwrap()
      message.success(`Audit ${audit.reference} saved.`)
      navigate(`/inventory/audits/${audit.id}`)
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not save the audit.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New audit</h1>
          <p>
            Count what's physically on hand. We snapshot the system quantity and
            show the variance — saving records the count only, it doesn't change
            stock. Reconcile any variances afterwards with an adjustment.
          </p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 760 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ date: dayjs(), note: '', lines: [{}] }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Count date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="Location">
                <Select
                  placeholder="Where the count happened"
                  options={locationOptions}
                  notFoundContent="No active locations — add one under Locations."
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} placeholder="Optional — e.g. quarterly cycle count" />
          </Form.Item>

          <Divider style={{ margin: '4px 0 16px' }}>Counted items</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => {
                  const selected = lineValues[name]?.item
                  const meta = selected ? byKey.get(selected) : undefined
                  const counted = lineValues[name]?.countedQty
                  const variance =
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
                              <span>System: <strong>{meta.onHand}</strong> {meta.unit}</span>
                              {variance != null && variance !== 0 && (
                                <Tag color={variance > 0 ? 'success' : 'error'} style={{ marginInlineStart: 8 }}>
                                  {variance > 0 ? `+${variance}` : variance} variance
                                </Tag>
                              )}
                              {variance === 0 && (
                                <Tag style={{ marginInlineStart: 8 }}>matches</Tag>
                              )}
                            </>
                          ) : (
                            <span>Pick an item to see its system quantity.</span>
                          )}
                        </div>
                      </Col>
                      <Col flex="150px">
                        <Form.Item
                          {...rest}
                          name={[name, 'countedQty']}
                          style={{ marginBottom: 0 }}
                          rules={[
                            { required: true, message: 'Counted qty' },
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
                            placeholder="Counted"
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

          <div className="form-actions" style={{ marginTop: 20 }}>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Save audit
            </Button>
            <Button onClick={() => navigate('/inventory/audits')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default AuditFormPage
