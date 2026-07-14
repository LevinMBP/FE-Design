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
import type { StockItemKind } from '../types'
import './audits.css'

interface LineValues {
  itemId?: string
  countedQty?: number
}

interface FormValues {
  date: Dayjs
  itemType: StockItemKind
  locationId: string
  note: string
  lines: LineValues[]
}

const ITEM_TYPE_OPTIONS = [
  { value: 'material', label: 'Material' },
  { value: 'product', label: 'Product' },
]

/**
 * Record a physical stock count. The document's item type (material/product)
 * scopes the whole count — the item picker only offers that kind, and the
 * saved lines all carry it. Selecting an item snapshots its system on-hand as
 * the expected quantity and pre-fills the counted quantity with it (override
 * where the shelf disagrees); the variance is shown live. Saving stores the
 * audit but changes NO stock — reconciling a variance is a separate Adjustment
 * (which can be fast-tracked from the audit afterwards).
 */
function AuditFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const { data: stockItems, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: locations } = useGetLocationsQuery()
  const [addAudit, { isLoading }] = useAddAuditMutation()
  const lineValues = Form.useWatch('lines', form) ?? []
  const itemType: StockItemKind = Form.useWatch('itemType', form) ?? 'material'

  const locationOptions = (locations ?? [])
    .filter((l) => l.status === 'active')
    .map((l) => ({ value: l.id, label: l.code ? `${l.name} (${l.code})` : l.name }))

  useEffect(() => {
    if (!form.getFieldValue('locationId') && locationOptions.length > 0) {
      form.setFieldValue('locationId', locationOptions[0].value)
    }
  }, [form, locationOptions])

  // Picker restricted to the document's item type, plus on-hand/unit lookups.
  const { itemOptions, byId } = useMemo(() => {
    const byId = new Map<string, { onHand: number; unit: string }>()
    const itemOptions = (stockItems ?? [])
      .filter((s) => s.kind === itemType)
      .map((s) => {
        byId.set(s.id, { onHand: s.onHand, unit: s.unit })
        return { value: s.id, label: `${s.name} (${s.sku})` }
      })
    return { itemOptions, byId }
  }, [stockItems, itemType])

  // Auto-populate: counted starts at the expected (system) qty, overridable.
  const onItemSelected = (lineIdx: number, itemId: string) => {
    const meta = byId.get(itemId)
    form.setFieldValue(['lines', lineIdx, 'countedQty'], meta?.onHand)
  }

  const onFinish = async (values: FormValues) => {
    const lines = (values.lines ?? [])
      .filter((l) => l?.itemId && l.countedQty != null)
      .map((l) => ({ itemId: l.itemId!, countedQty: l.countedQty! }))
    if (lines.length === 0) {
      message.error('Add at least one item with a counted quantity.')
      return
    }

    try {
      const audit = await addAudit({
        date: values.date.format('YYYY-MM-DD'),
        itemType: values.itemType,
        locationId: values.locationId,
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
            Count what's physically on hand. We snapshot the system quantity as
            the expected count and pre-fill the counted quantity — override it
            where the shelf disagrees. Saving records the count only, it doesn't
            change stock. Reconcile any variances afterwards with an adjustment.
          </p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 760 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ date: dayjs(), itemType: 'material', note: '', lines: [{}] }}
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
                name="locationId"
                label="Inventory location"
                tooltip="Location where the audit will be performed"
                rules={[{ required: true, message: 'Pick a location' }]}
              >
                <Select
                  placeholder="Where the count happened"
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
                label="Audit type"
                tooltip="What this count covers — the item list below follows it"
                rules={[{ required: true }]}
              >
                <Select
                  options={ITEM_TYPE_OPTIONS}
                  onChange={() => form.setFieldValue('lines', [{}])}
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
                  const selected = lineValues[name]?.itemId
                  const meta = selected ? byId.get(selected) : undefined
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
                          name={[name, 'itemId']}
                          style={{ marginBottom: 0 }}
                          rules={[{ required: true, message: 'Select an item' }]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder={itemType === 'material' ? 'Material' : 'Product'}
                            loading={itemsLoading}
                            options={itemOptions}
                            onChange={(v: string) => onItemSelected(name, v)}
                          />
                        </Form.Item>
                        <div className="audit-line-meta">
                          {meta ? (
                            <>
                              <span>Expected: <strong>{meta.onHand}</strong> {meta.unit}</span>
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
                            <span>Pick an item to snapshot its expected quantity.</span>
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
