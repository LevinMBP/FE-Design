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
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useAddPurchaseMutation,
  useGetLocationsQuery,
  useGetNextPurchaseRefQuery,
  useGetStockItemsQuery,
} from '../inventory/inventoryApi'
import { useGetVendorsQuery } from '../contacts/contactsApi'
import { useGetTaxesQuery } from '../finance/financeApi'
import { isPurchaseTax } from '../finance/types'
import {
  PURCHASE_TYPE_LABELS,
  purchaseAddsStock,
  type PurchaseLineInput,
  type PurchaseType,
  type StockItem,
} from '../inventory/types'
import '../sales/SalesDocuments.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const itemValue = (i: StockItem) => `${i.kind}:${i.id}`

interface LineValues {
  type: PurchaseType
  item?: string
  description?: string
  location?: string
  quantity?: number
  amount?: number
  taxes?: string[]
}

interface FormValues {
  reference: string
  vendorId?: string
  date: Dayjs
  paymentTermDays?: number
  note?: string
  lines: LineValues[]
}

// Adds N business days to a date, skipping Saturdays and Sundays.
function addBusinessDays(start: Dayjs, days: number): Dayjs {
  let result = start
  let remaining = days
  while (remaining > 0) {
    result = result.add(1, 'day')
    if (result.day() !== 0 && result.day() !== 6) remaining -= 1
  }
  return result
}

const TYPE_OPTIONS = (Object.keys(PURCHASE_TYPE_LABELS) as PurchaseType[]).map(
  (t) => ({ value: t, label: PURCHASE_TYPE_LABELS[t] }),
)

const NEW_LINE: LineValues = { type: 'material', taxes: [] }

function PurchaseFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data: items, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: locations } = useGetLocationsQuery()
  const { data: vendors } = useGetVendorsQuery()
  const { data: taxes } = useGetTaxesQuery()
  const { data: nextRef } = useGetNextPurchaseRefQuery()
  const [addPurchase, { isLoading }] = useAddPurchaseMutation()
  const [form] = Form.useForm<FormValues>()

  const lines = Form.useWatch('lines', form) ?? []

  // Pre-fill the PO# with the next auto number once it loads (still editable).
  useEffect(() => {
    if (nextRef && !form.getFieldValue('reference')) {
      form.setFieldValue('reference', nextRef)
    }
  }, [nextRef, form])

  // Taxes that can be added on a purchase (input VAT etc.).
  const purchaseTaxes = (taxes ?? []).filter(isPurchaseTax)
  const taxById = useMemo(
    () => new Map(purchaseTaxes.map((t) => [t.id, t])),
    [purchaseTaxes],
  )

  const itemOptions = (items ?? []).map((i) => ({
    value: itemValue(i),
    label: `${i.name} (${i.sku})`,
  }))
  const locationOptions = (locations ?? [])
    .filter((l) => l.status === 'active')
    .map((l) => ({ value: l.id, label: l.name }))
  const taxOptions = purchaseTaxes.map((t) => ({
    value: t.id,
    label: `${t.name} ${t.rate}%`,
  }))

  // --- Live totals (subtotal, per-tax breakdown, grand total) ----------------
  const lineSub = (l?: LineValues) => {
    const stock = purchaseAddsStock(l?.type ?? 'material')
    const qty = l?.quantity ?? (stock ? 0 : 1)
    return qty * (l?.amount ?? 0)
  }
  const lineTotal = (l?: LineValues) => {
    const sub = lineSub(l)
    const tax = (l?.taxes ?? []).reduce((s, id) => {
      const t = taxById.get(id)
      return s + (t ? sub * (t.rate / 100) : 0)
    }, 0)
    return sub + tax
  }

  let subtotal = 0
  const taxTotals = new Map<string, { label: string; amount: number }>()
  for (const l of lines) {
    const sub = lineSub(l)
    subtotal += sub
    for (const id of l?.taxes ?? []) {
      const t = taxById.get(id)
      if (!t) continue
      const cur = taxTotals.get(id)
      const amt = sub * (t.rate / 100)
      if (cur) cur.amount += amt
      else taxTotals.set(id, { label: `${t.name} ${t.rate}%`, amount: amt })
    }
  }
  const taxAmount = [...taxTotals.values()].reduce((s, t) => s + t.amount, 0)
  const total = subtotal + taxAmount

  // When a line's type changes, clear the fields that no longer apply.
  const onLineTypeChange = (name: number) => {
    const next = (form.getFieldValue('lines') as LineValues[]).slice()
    next[name] = {
      ...next[name],
      item: undefined,
      description: undefined,
      location: undefined,
      amount: undefined,
    }
    form.setFieldsValue({ lines: next })
  }

  const onItemChange = (name: number, value: string) => {
    const [kind, id] = value.split(':')
    const item = (items ?? []).find((i) => i.kind === kind && i.id === id)
    if (!item) return
    const next = form.getFieldValue('lines') as LineValues[]
    if (next[name] && (next[name].amount == null || next[name].amount === 0)) {
      next[name] = { ...next[name], amount: item.avgCost }
      form.setFieldsValue({ lines: next })
    }
  }

  const onFinish = async (values: FormValues) => {
    const usable = (values.lines ?? []).filter((l) =>
      purchaseAddsStock(l?.type) ? l?.item && (l.quantity ?? 0) > 0 : (l?.amount ?? 0) > 0,
    )
    if (usable.length === 0) {
      message.error('Add at least one line with an amount.')
      return
    }
    const lineInputs: PurchaseLineInput[] = usable.map((l) => {
      const stock = purchaseAddsStock(l.type)
      const base = {
        type: l.type,
        quantity: l.quantity ?? (stock ? 0 : 1),
        amount: l.amount ?? 0,
        taxIds: l.taxes ?? [],
      }
      if (stock) {
        const [kind, id] = (l.item as string).split(':')
        return {
          ...base,
          itemKind: kind as StockItem['kind'],
          itemId: id,
          locationId: l.location,
        }
      }
      return { ...base, description: l.description ?? '' }
    })
    try {
      const purchase = await addPurchase({
        reference: (values.reference ?? '').trim(),
        date: values.date.format('YYYY-MM-DD'),
        dueDate:
          values.paymentTermDays != null
            ? addBusinessDays(values.date, values.paymentTermDays).format('YYYY-MM-DD')
            : '',
        vendorId: values.vendorId ?? '',
        note: values.note ?? '',
        lines: lineInputs,
      }).unwrap()
      const received = lineInputs.some((l) => purchaseAddsStock(l.type))
      message.success(
        received
          ? `Purchase ${purchase.reference} saved — stock received.`
          : `Purchase ${purchase.reference} recorded.`,
      )
      navigate('/purchases/orders')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not save. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New purchase</h1>
          <p>
            Set the type per line: Material and Product lines receive stock into a
            location; Asset, Service and Expense lines are recorded for accounting only.
          </p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 960 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            reference: '',
            date: dayjs(),
            paymentTermDays: 30,
            note: '',
            lines: [{ ...NEW_LINE }],
          }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col xs={12} sm={12} md={8}>
              <Form.Item
                name="reference"
                label="PO #"
                rules={[{ required: true, message: 'PO number is required' }]}
              >
                <Input placeholder="PO-001" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} md={8}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} md={8}>
              <Form.Item
                name="paymentTermDays"
                label="Payment term (days)"
                tooltip="Automatically skips weekends when calculating the due date."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  placeholder="e.g. 30"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="vendorId"
                label="Vendor"
                rules={[{ required: true, message: 'Vendor is required' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select a vendor"
                  options={(vendors ?? []).map((v) => ({ value: v.id, label: v.company }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} placeholder="Optional note for this purchase" />
          </Form.Item>

          <Divider style={{ margin: '4px 0 16px' }}>Lines</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }, idx) => {
                  const l = lines[name]
                  const stock = purchaseAddsStock(l?.type ?? 'material')
                  return (
                    <div key={key} className="docline-card">
                      <div className="docline-header">
                        <span className="docline-header__index">Line {idx + 1}</span>
                        <Button
                          type="text"
                          danger
                          aria-label="Remove line"
                          icon={<Trash2 size={16} />}
                          disabled={fields.length === 1}
                          onClick={() => remove(name)}
                        />
                      </div>

                      <Row gutter={12} align="middle">
                        <Col xs={24} sm={8} md={5}>
                          <Form.Item
                            {...rest}
                            name={[name, 'type']}
                            label="Type"
                            rules={[{ required: true, message: 'Type' }]}
                            style={{ marginBottom: 8 }}
                          >
                            <Select
                              options={TYPE_OPTIONS}
                              onChange={() => onLineTypeChange(name)}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={16} md={stock ? 11 : 19}>
                          {stock ? (
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
                                placeholder="Item"
                                loading={itemsLoading}
                                options={itemOptions}
                                onChange={(value) => onItemChange(name, value)}
                              />
                            </Form.Item>
                          ) : (
                            <Form.Item
                              {...rest}
                              name={[name, 'description']}
                              label="Description"
                              rules={[{ required: true, message: 'Enter a description' }]}
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="e.g. Delivery van, Rent, Consulting" />
                            </Form.Item>
                          )}
                        </Col>
                        {stock && (
                          <Col xs={24} sm={24} md={8}>
                            <Form.Item
                              {...rest}
                              name={[name, 'location']}
                              label="Location"
                              rules={[{ required: true, message: 'Select a location' }]}
                              style={{ marginBottom: 8 }}
                            >
                              <Select
                                placeholder="Where to store"
                                options={locationOptions}
                              />
                            </Form.Item>
                          </Col>
                        )}
                      </Row>

                      <Row gutter={12} align="middle">
                        <Col xs={12} sm={6} md={4}>
                          <Form.Item
                            {...rest}
                            name={[name, 'quantity']}
                            label="Qty"
                            rules={stock ? [{ required: true, message: 'Qty' }] : []}
                            style={{ marginBottom: 8 }}
                          >
                            <InputNumber
                              min={stock ? 1 : 0}
                              placeholder={stock ? 'Qty' : 'Qty (1)'}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} sm={6} md={5}>
                          <Form.Item
                            {...rest}
                            name={[name, 'amount']}
                            label={stock ? 'Unit cost' : 'Amount'}
                            rules={[{ required: true, message: stock ? 'Unit cost' : 'Amount' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={0}
                              step={0.5}
                              prefix="₱"
                              placeholder={stock ? 'Unit cost' : 'Amount'}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={11}>
                          <Form.Item
                            {...rest}
                            name={[name, 'taxes']}
                            label="Taxes"
                            style={{ marginBottom: 0 }}
                          >
                            <Select
                              mode="multiple"
                              allowClear
                              placeholder="Add taxes (e.g. VAT 12%)"
                              optionFilterProp="label"
                              options={taxOptions}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={24} md={4} className="docline-total">
                          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                            Line total
                          </div>
                          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {peso(lineTotal(l))}
                          </strong>
                        </Col>
                      </Row>
                    </div>
                  )
                })}
                <Button
                  type="dashed"
                  onClick={() => add({ ...NEW_LINE })}
                  icon={<Plus size={16} />}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  Add line
                </Button>
              </>
            )}
          </Form.List>

          <div className="salesdoc-totals">
            <div className="salesdoc-totals__row">
              <span>Subtotal</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{peso(subtotal)}</span>
            </div>
            {[...taxTotals.values()].map((t) => (
              <div className="salesdoc-totals__row" key={t.label}>
                <span>{t.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{peso(t.amount)}</span>
              </div>
            ))}
            {taxAmount > 0 && (
              <div className="salesdoc-totals__row">
                <span>Total tax</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{peso(taxAmount)}</span>
              </div>
            )}
            <div className="salesdoc-totals__row is-total">
              <span>Total payable to vendor</span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{peso(total)}</strong>
            </div>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Save purchase
            </Button>
            <Button onClick={() => navigate('/purchases/orders')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default PurchaseFormPage
