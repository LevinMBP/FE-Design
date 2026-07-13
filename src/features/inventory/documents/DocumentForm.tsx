import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  InputNumber,
  Row,
  Select,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import type { DocumentLineInput, StockItem } from '../types'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

/** Encode/decode an item as a single select value ("kind:id"). */
const itemValue = (i: StockItem) => `${i.kind}:${i.id}`

interface LineValues {
  item?: string
  quantity?: number
  amount?: number
}

interface FormValues {
  date: Dayjs
  partyId?: string
  lines: LineValues[]
}

export interface DocumentFormProps {
  title: string
  subtitle: string
  partyLabel: string
  partyPlaceholder: string
  partyOptions: { value: string; label: string }[]
  amountLabel: string
  items: StockItem[]
  itemsLoading?: boolean
  /** Default unit amount when an item is picked (cost for purchases, price for sales). */
  defaultAmount: (item: StockItem) => number
  /** Show each item's current on-hand in the option label (useful for sales). */
  showOnHand?: boolean
  submitLabel: string
  loading?: boolean
  cancelTo: string
  onSubmit: (input: {
    date: string
    partyId: string
    lines: DocumentLineInput[]
  }) => Promise<void>
}

function DocumentForm(props: DocumentFormProps) {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const lines = Form.useWatch('lines', form) ?? []

  const total = lines.reduce(
    (sum, l) => sum + (l?.quantity ?? 0) * (l?.amount ?? 0),
    0,
  )

  const itemOptions = props.items.map((i) => ({
    value: itemValue(i),
    label: props.showOnHand
      ? `${i.name} (${i.sku}) · ${i.onHand.toLocaleString()} ${i.unit} on hand`
      : `${i.name} (${i.sku})`,
  }))

  const onItemChange = (name: number, value: string) => {
    const [kind, id] = value.split(':')
    const item = props.items.find((i) => i.kind === kind && i.id === id)
    if (!item) return
    const next = form.getFieldValue('lines') as LineValues[]
    if (next[name] && (next[name].amount == null || next[name].amount === 0)) {
      next[name] = { ...next[name], amount: props.defaultAmount(item) }
      form.setFieldsValue({ lines: next })
    }
  }

  const onFinish = async (values: FormValues) => {
    const usable = (values.lines ?? []).filter((l) => l?.item && (l.quantity ?? 0) > 0)
    if (usable.length === 0) {
      message.error('Add at least one item with a quantity.')
      return
    }
    const docLines: DocumentLineInput[] = usable.map((l) => {
      const [kind, id] = (l.item as string).split(':')
      return {
        itemKind: kind as StockItem['kind'],
        itemId: id,
        quantity: l.quantity as number,
        amount: l.amount ?? 0,
      }
    })
    try {
      await props.onSubmit({
        date: values.date.format('YYYY-MM-DD'),
        partyId: values.partyId ?? '',
        lines: docLines,
      })
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not save. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>{props.title}</h1>
          <p>{props.subtitle}</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 760 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ date: dayjs(), lines: [{}] }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="partyId"
                label={props.partyLabel}
                rules={[{ required: true, message: `${props.partyLabel} is required` }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={props.partyPlaceholder}
                  options={props.partyOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }}>Items</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row gutter={12} key={key} align="middle" style={{ marginBottom: 4 }}>
                    <Col span={11}>
                      <Form.Item
                        {...rest}
                        name={[name, 'item']}
                        rules={[{ required: true, message: 'Select an item' }]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="Item"
                          loading={props.itemsLoading}
                          options={itemOptions}
                          onChange={(value) => onItemChange(name, value)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...rest}
                        name={[name, 'quantity']}
                        rules={[{ required: true, message: 'Qty' }]}
                      >
                        <InputNumber min={1} placeholder="Qty" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...rest}
                        name={[name, 'amount']}
                        rules={[{ required: true, message: props.amountLabel }]}
                      >
                        <InputNumber
                          min={0}
                          step={0.5}
                          prefix="₱"
                          placeholder={props.amountLabel}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button
                        type="text"
                        aria-label="Remove line"
                        icon={<Trash2 size={16} />}
                        disabled={fields.length === 1}
                        onClick={() => remove(name)}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({})}
                  icon={<Plus size={16} />}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  Add item
                </Button>
              </>
            )}
          </Form.List>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              margin: '18px 0',
              fontSize: 16,
            }}
          >
            <span style={{ marginRight: 12, color: 'var(--text-muted)' }}>Total</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{peso(total)}</strong>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={props.loading}>
              {props.submitLabel}
            </Button>
            <Button onClick={() => navigate(props.cancelTo)}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default DocumentForm
