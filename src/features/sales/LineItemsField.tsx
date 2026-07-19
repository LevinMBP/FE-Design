import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
  type FormInstance,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { StockItem } from '../inventory/types'
import type { Tax } from '../finance/types'
import { peso } from './salesDocMath'
import { itemValue, type ItemMeta } from './salesFormShared'

interface LineFieldValues {
  item?: string
  packaging?: string
  description?: string
  quantity?: number
  unitPrice?: number
  taxIds?: string[]
  taxIncluded?: boolean
}

interface Props {
  form: FormInstance
  items: StockItem[]
  itemsLoading?: boolean
  itemMeta: Map<string, ItemMeta>
  /** Sales-applicable taxes offered on each line. */
  taxes: Tax[]
  /** Quotations show packaging + description; invoices keep lines lean. */
  showDetails?: boolean
}

/**
 * The line-items editor for both document kinds. Picking an item auto-fills its
 * default price (and, when detailed, its packaging/description). Each line has a
 * "Tax in" switch (disabled until the line has a tax); new lines inherit
 * the "apply to all" default.
 */
function LineItemsField({ form, items, itemsLoading, itemMeta, taxes, showDetails }: Props) {
  const lines = (Form.useWatch('lines', form) ?? []) as LineFieldValues[]

  const taxOptions = taxes.map((t) => ({
    value: t.id,
    label: `${t.name} ${t.rate}%`,
  }))

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

  return (
    <Form.List name="lines">
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...rest }, idx) => {
            const l = lines[name]
            const lineTotal = (l?.quantity ?? 0) * (l?.unitPrice ?? 0)
            const lineHasTax = (l?.taxIds?.length ?? 0) > 0
            return (
              <div key={key} className="line-card">
                <div className="line-card__head">
                  <span className="line-card__index">Item {idx + 1}</span>
                  <div className="line-card__right">
                    <span className="line-card__total">
                      <span className="line-card__total-label">Line total</span>
                      <span className="line-card__total-value">{peso(lineTotal)}</span>
                    </span>
                    <Button
                      type="text"
                      danger
                      aria-label="Remove line"
                      icon={<Trash2 size={16} />}
                      disabled={fields.length === 1}
                      onClick={() => remove(name)}
                    />
                  </div>
                </div>

                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      {...rest}
                      name={[name, 'item']}
                      label="Item"
                      rules={[{ required: true, message: 'Select an item' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Select an item"
                        loading={itemsLoading}
                        options={itemOptions}
                        onChange={(value) => onItemChange(name, value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={8} md={4}>
                    <Form.Item
                      {...rest}
                      name={[name, 'quantity']}
                      label="Qty"
                      rules={[{ required: true, message: 'Qty' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={1} placeholder="Qty" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={16} md={5}>
                    <Form.Item
                      {...rest}
                      name={[name, 'unitPrice']}
                      label="Unit price"
                      rules={[{ required: true, message: 'Unit price' }]}
                      style={{ marginBottom: 8 }}
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
                  <Col xs={24} md={3}>
                    <Form.Item
                      {...rest}
                      name={[name, 'taxIncluded']}
                      label="Tax in"
                      tooltip="This line's price already includes its taxes"
                      valuePropName="checked"
                      style={{ marginBottom: 8 }}
                    >
                      <Switch disabled={!lineHasTax} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col xs={24} md={showDetails ? 9 : 12}>
                    <Form.Item
                      {...rest}
                      name={[name, 'taxIds']}
                      label="Taxes"
                      style={{ marginBottom: 8 }}
                    >
                      <Select
                        mode="multiple"
                        allowClear
                        placeholder="e.g. VAT 12%"
                        optionFilterProp="label"
                        options={taxOptions}
                      />
                    </Form.Item>
                  </Col>
                  {showDetails && (
                    <>
                      <Col xs={24} md={6}>
                        <Form.Item
                          {...rest}
                          name={[name, 'packaging']}
                          label="Packaging"
                          style={{ marginBottom: 8 }}
                        >
                          <Input placeholder="Auto-filled from the item" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={9}>
                        <Form.Item
                          {...rest}
                          name={[name, 'description']}
                          label="Description"
                          style={{ marginBottom: 8 }}
                        >
                          <Input placeholder="Auto-filled from the item" />
                        </Form.Item>
                      </Col>
                    </>
                  )}
                </Row>
              </div>
            )
          })}
          <Button
            type="dashed"
            onClick={() =>
              add({
                taxIds: form.getFieldValue('docTaxIds') ?? [],
                taxIncluded: form.getFieldValue('applyTaxAll') ?? false,
              })
            }
            icon={<Plus size={16} />}
            style={{ width: '100%', marginTop: 4 }}
          >
            Add item
          </Button>
        </>
      )}
    </Form.List>
  )
}

export default LineItemsField
