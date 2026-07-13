import {
  Button,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Tooltip,
  type FormInstance,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { StockItem } from '../inventory/types'
import { itemValue, type ItemMeta } from './salesFormShared'

interface LineFieldValues {
  item?: string
  packaging?: string
  description?: string
  quantity?: number
  unitPrice?: number
  taxIncluded?: boolean
}

interface Props {
  form: FormInstance
  items: StockItem[]
  itemsLoading?: boolean
  itemMeta: Map<string, ItemMeta>
  /** Quotations show packaging + description; invoices keep lines lean. */
  showDetails?: boolean
}

/**
 * The line-items editor for both document kinds. Picking an item auto-fills its
 * default price (and, when detailed, its packaging/description). Each line has a
 * "Tax in" checkbox (disabled until a document tax is chosen); new lines inherit
 * the "apply to all" default.
 */
function LineItemsField({ form, items, itemsLoading, itemMeta, showDetails }: Props) {
  const hasTax = !!Form.useWatch('taxId', form)

  const itemOptions = items.map((i) => ({
    value: itemValue(i),
    label: `${i.name} (${i.sku}) · ${i.onHand.toLocaleString()} ${i.unit} on hand`,
  }))

  const onItemChange = (name: number, value: string) => {
    const meta = itemMeta.get(value)
    if (!meta) return
    const next = [...(form.getFieldValue('lines') as LineFieldValues[])]
    const line = { ...(next[name] ?? {}) }
    if (line.unitPrice == null || line.unitPrice === 0) line.unitPrice = meta.price
    if (showDetails) {
      if (!line.packaging) line.packaging = meta.packaging
      if (!line.description) line.description = meta.description
    }
    next[name] = line
    form.setFieldsValue({ lines: next })
  }

  const taxCheckbox = (name: number, rest: object) => (
    <Tooltip title="This line's price already includes the document tax">
      <span>
        <Form.Item
          {...rest}
          name={[name, 'taxIncluded']}
          valuePropName="checked"
          noStyle
        >
          <Checkbox disabled={!hasTax} />
        </Form.Item>
      </span>
    </Tooltip>
  )

  return (
    <Form.List name="lines">
      {(fields, { add, remove }) => (
        <>
          <Row
            gutter={12}
            style={{
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-muted)',
            }}
          >
            <Col span={showDetails ? 9 : 10}>Item</Col>
            <Col span={4}>Qty</Col>
            <Col span={showDetails ? 6 : 5}>Unit price</Col>
            <Col span={3} style={{ textAlign: 'center' }}>
              Tax in
            </Col>
            <Col span={2} />
          </Row>

          {fields.map(({ key, name, ...rest }) => (
            <div
              key={key}
              style={{
                marginBottom: showDetails ? 12 : 8,
                paddingBottom: showDetails ? 10 : 0,
                borderBottom: showDetails
                  ? '1px dashed var(--border)'
                  : undefined,
              }}
            >
              <Row gutter={12} align="middle" style={{ marginBottom: showDetails ? 8 : 0 }}>
                <Col span={showDetails ? 9 : 10}>
                  <Form.Item
                    {...rest}
                    name={[name, 'item']}
                    rules={[{ required: true, message: 'Select an item' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Item"
                      loading={itemsLoading}
                      options={itemOptions}
                      onChange={(value) => onItemChange(name, value)}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item
                    {...rest}
                    name={[name, 'quantity']}
                    rules={[{ required: true, message: 'Qty' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={1} placeholder="Qty" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={showDetails ? 6 : 5}>
                  <Form.Item
                    {...rest}
                    name={[name, 'unitPrice']}
                    rules={[{ required: true, message: 'Unit price' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      step={0.5}
                      prefix="₱"
                      placeholder="Unit price"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={3} style={{ textAlign: 'center' }}>
                  {taxCheckbox(name, rest)}
                </Col>
                <Col span={2} style={{ textAlign: 'right' }}>
                  <Button
                    type="text"
                    aria-label="Remove line"
                    icon={<Trash2 size={16} />}
                    disabled={fields.length === 1}
                    onClick={() => remove(name)}
                  />
                </Col>
              </Row>

              {showDetails && (
                <Row gutter={12}>
                  <Col span={9}>
                    <Form.Item {...rest} name={[name, 'packaging']} style={{ marginBottom: 0 }}>
                      <Input placeholder="Packaging (auto)" size="small" />
                    </Form.Item>
                  </Col>
                  <Col span={15}>
                    <Form.Item {...rest} name={[name, 'description']} style={{ marginBottom: 0 }}>
                      <Input placeholder="Description (auto)" size="small" />
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => add({ taxIncluded: form.getFieldValue('applyTaxAll') ?? false })}
            icon={<Plus size={16} />}
            style={{ width: '100%', marginTop: 4 }}
          >
            Add item
          </Button>
          {showDetails && <Divider style={{ margin: '16px 0 0' }} />}
        </>
      )}
    </Form.List>
  )
}

export default LineItemsField
