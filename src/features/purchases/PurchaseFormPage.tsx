import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Switch,
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
import { computeTotals, peso } from '../sales/salesDocMath'

const itemValue = (i: StockItem) => `${i.kind}:${i.id}`

interface LineValues {
  type?: PurchaseType
  item?: string
  description?: string
  location?: string
  quantity?: number
  amount?: number
  taxes?: string[]
  /** When true the entered unit cost already contains the selected taxes. */
  taxIncluded?: boolean
}

interface FormValues {
  reference: string
  vendorId?: string
  date: Dayjs
  paymentTermDays?: number
  note?: string
  lines: LineValues[]
  discountType: 'amount' | 'percent'
  discountValue?: number
  /** Fast-apply: taxes stamped onto every line (lines stay editable). */
  docTaxIds?: string[]
  /** Fast-apply: tax-included flag stamped onto every line. */
  applyTaxAll?: boolean
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

// Lines start typeless: the item/description fields appear once a type is picked.
const NEW_LINE: LineValues = { taxes: [], taxIncluded: false }

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
  const discountType = (Form.useWatch('discountType', form) ?? 'amount') as
    | 'amount'
    | 'percent'
  const discountValue = Form.useWatch('discountValue', form) ?? 0
  const docTaxIds = (Form.useWatch('docTaxIds', form) ?? []) as string[]
  const dateValue = Form.useWatch('date', form)
  const termDays = Form.useWatch('paymentTermDays', form)
  const dueDate =
    dateValue && termDays != null ? addBusinessDays(dateValue, termDays) : null

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

  // One option list per stock kind — a Material line only offers materials.
  const itemOptionsByKind = useMemo(() => {
    const toOption = (i: StockItem) => ({
      value: itemValue(i),
      label: `${i.name} (${i.sku})`,
    })
    return {
      material: (items ?? []).filter((i) => i.kind === 'material').map(toOption),
      product: (items ?? []).filter((i) => i.kind === 'product').map(toOption),
    }
  }, [items])
  const locationOptions = (locations ?? [])
    .filter((l) => l.status === 'active')
    .map((l) => ({ value: l.id, label: l.name }))
  const taxOptions = purchaseTaxes.map((t) => ({
    value: t.id,
    label: `${t.name} ${t.rate}%`,
  }))

  // --- Live totals (subtotal, per-tax breakdown, grand total) ----------------
  // Combined rate of a line's selected taxes, as a fraction (12% → 0.12).
  const lineRates = (l?: LineValues) =>
    (l?.taxes ?? []).reduce((s, id) => s + (taxById.get(id)?.rate ?? 0), 0) / 100

  // Qty × amount as ENTERED — the net under "exclusive", the gross under
  // "inclusive". Typeless lines count as nothing yet.
  const lineEntered = (l?: LineValues) => {
    if (!l?.type) return 0
    const qty = l.quantity ?? (purchaseAddsStock(l.type) ? 0 : 1)
    return qty * (l.amount ?? 0)
  }
  // Net-of-tax line value: tax-included amounts have the tax divided back out.
  const lineNet = (l?: LineValues) => {
    const entered = lineEntered(l)
    return l?.taxIncluded ? entered / (1 + lineRates(l)) : entered
  }
  const lineTotal = (l?: LineValues) => lineNet(l) * (1 + lineRates(l))

  // Same money breakdown as the sales documents:
  // subtotal → discount → gross → per-tax rows → total.
  const totals = computeTotals(
    lines.map((l) => ({
      quantity: l?.type ? l.quantity ?? (purchaseAddsStock(l.type) ? 0 : 1) : 0,
      unitPrice: l?.amount ?? 0,
      taxIds: l?.taxes ?? [],
      taxIncluded: !!l?.taxIncluded,
    })),
    discountType,
    discountValue,
    purchaseTaxes,
  )

  const hasTax =
    docTaxIds.length > 0 || lines.some((l) => (l?.taxes?.length ?? 0) > 0)

  // Fast-apply: stamp the document-level tax selection / tax-in flag onto
  // every line. Individual lines can still be overridden afterwards.
  const applyTaxesToAll = (taxIds: string[]) => {
    const current = (form.getFieldValue('lines') as LineValues[]) ?? []
    form.setFieldsValue({
      lines: current.map((l) => ({ ...l, taxes: [...taxIds] })),
    })
  }
  const applyTaxInToAll = (checked: boolean) => {
    const current = (form.getFieldValue('lines') as LineValues[]) ?? []
    form.setFieldsValue({
      lines: current.map((l) => ({ ...l, taxIncluded: checked })),
    })
  }

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
    const usable = (values.lines ?? []).filter((l) => {
      if (!l?.type) return false
      return purchaseAddsStock(l.type)
        ? l.item && (l.quantity ?? 0) > 0
        : (l.amount ?? 0) > 0
    })
    if (usable.length === 0) {
      message.error('Add at least one line with an amount.')
      return
    }
    const lineInputs: PurchaseLineInput[] = usable.map((l) => {
      const type = l.type!
      const stock = purchaseAddsStock(type)
      // The backend prices tax-exclusively; strip the tax out of tax-in amounts.
      const rates = lineRates(l)
      const amount =
        l.taxIncluded && rates > 0 ? (l.amount ?? 0) / (1 + rates) : (l.amount ?? 0)
      const base = {
        type,
        quantity: l.quantity ?? (stock ? 0 : 1),
        amount,
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
        discountType: values.discountType,
        discountValue: values.discountValue ?? 0,
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
            discountType: 'amount',
            discountValue: 0,
            docTaxIds: [],
            applyTaxAll: false,
          }}
          onFinish={onFinish}
        >
          <div className="form-section">
            <div className="form-section__title">Order details</div>
            <Row gutter={16}>
              <Col xs={24} md={9}>
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
              <Col xs={24} sm={8} md={5}>
                <Form.Item
                  name="reference"
                  label="PO #"
                  rules={[{ required: true, message: 'PO number is required' }]}
                >
                  <Input placeholder="PO-001" />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={5}>
                <Form.Item
                  name="date"
                  label="Date"
                  rules={[{ required: true, message: 'Date is required' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={5}>
                <Form.Item
                  name="paymentTermDays"
                  label="Payment term (days)"
                  tooltip="Automatically skips weekends when calculating the due date."
                  extra={dueDate ? `Due ${dueDate.format('MMM D, YYYY')}` : undefined}
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

            <Form.Item name="note" label="Note" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={2} placeholder="Optional note for this purchase" />
            </Form.Item>
          </div>

          <div className="form-section__title">Line items</div>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }, idx) => {
                  const l = lines[name]
                  const type = l?.type
                  const stock = type ? purchaseAddsStock(type) : false
                  const itemLabel = type === 'material' ? 'Material' : 'Product'
                  return (
                    <div key={key} className="line-card">
                      <div className="line-card__head">
                        <span className="line-card__index">Line {idx + 1}</span>
                        <div className="line-card__right">
                          {type && (
                            <span className="line-card__total">
                              <span className="line-card__total-label">Line total</span>
                              <span className="line-card__total-value">
                                {peso(lineTotal(l))}
                              </span>
                            </span>
                          )}
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

                      {/* What the line is: type first, then the matching
                          detail fields appear beside it. */}
                      <Row gutter={12}>
                        <Col xs={24} sm={8} md={6}>
                          <Form.Item
                            {...rest}
                            name={[name, 'type']}
                            label="Type"
                            rules={[{ required: true, message: 'Type' }]}
                            style={{ marginBottom: 8 }}
                          >
                            <Select
                              placeholder="What is this line?"
                              options={TYPE_OPTIONS}
                              onChange={() => onLineTypeChange(name)}
                            />
                          </Form.Item>
                        </Col>
                        {!type && (
                          <Col xs={24} sm={16} md={18}>
                            <div className="line-hint">
                              Choose a type — Material and Product lines receive stock;
                              Asset, Service and Expense lines are accounting-only.
                            </div>
                          </Col>
                        )}
                        {type && stock && (
                          <>
                            <Col xs={24} sm={16} md={12}>
                              <Form.Item
                                {...rest}
                                name={[name, 'item']}
                                label={itemLabel}
                                rules={[
                                  {
                                    required: true,
                                    message: `Select a ${itemLabel.toLowerCase()}`,
                                  },
                                ]}
                                style={{ marginBottom: 8 }}
                              >
                                <Select
                                  showSearch
                                  optionFilterProp="label"
                                  placeholder={`Select a ${itemLabel.toLowerCase()}`}
                                  loading={itemsLoading}
                                  options={
                                    type === 'material'
                                      ? itemOptionsByKind.material
                                      : itemOptionsByKind.product
                                  }
                                  onChange={(value) => onItemChange(name, value)}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={24} md={6}>
                              <Form.Item
                                {...rest}
                                name={[name, 'location']}
                                label="Location"
                                rules={[{ required: true, message: 'Select a location' }]}
                                style={{ marginBottom: 8 }}
                              >
                                <Select placeholder="Where to store" options={locationOptions} />
                              </Form.Item>
                            </Col>
                          </>
                        )}
                        {type && !stock && (
                          <Col xs={24} sm={16} md={18}>
                            <Form.Item
                              {...rest}
                              name={[name, 'description']}
                              label="Description"
                              rules={[{ required: true, message: 'Enter a description' }]}
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="e.g. Delivery van, Rent, Consulting" />
                            </Form.Item>
                          </Col>
                        )}
                      </Row>

                      {/* How much: quantities, cost and taxes for the chosen type. */}
                      {type && (
                        <Row gutter={12}>
                          <Col xs={8} sm={4} md={4}>
                            <Form.Item
                              {...rest}
                              name={[name, 'quantity']}
                              label="Qty"
                              rules={stock ? [{ required: true, message: 'Qty' }] : []}
                              style={{ marginBottom: 8 }}
                            >
                              <InputNumber
                                min={stock ? 1 : 0}
                                placeholder={stock ? 'Qty' : '1'}
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={16} sm={8} md={5}>
                            <Form.Item
                              {...rest}
                              name={[name, 'amount']}
                              label={`${stock ? 'Unit cost' : 'Amount'}${
                                l?.taxIncluded ? ' (tax-in)' : ''
                              }`}
                              rules={[
                                { required: true, message: stock ? 'Unit cost' : 'Amount' },
                              ]}
                              style={{ marginBottom: 8 }}
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
                          <Col xs={24} sm={8} md={9}>
                            <Form.Item
                              {...rest}
                              name={[name, 'taxes']}
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
                          <Col xs={24} sm={4} md={6}>
                            <Form.Item
                              {...rest}
                              name={[name, 'taxIncluded']}
                              label="Tax included"
                              tooltip="On: the unit cost you enter already contains the selected taxes, and we break them out. Off: taxes are added on top."
                              valuePropName="checked"
                              style={{ marginBottom: 8 }}
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                        </Row>
                      )}
                    </div>
                  )
                })}
                <Button
                  type="dashed"
                  onClick={() =>
                    add({
                      ...NEW_LINE,
                      taxes: form.getFieldValue('docTaxIds') ?? [],
                      taxIncluded: form.getFieldValue('applyTaxAll') ?? false,
                    })
                  }
                  icon={<Plus size={16} />}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  Add line
                </Button>
              </>
            )}
          </Form.List>

          <div className="form-section__title" style={{ margin: '20px 0 16px' }}>
            Discount &amp; tax
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="discountType" label="Discount type">
                <Segmented
                  block
                  options={[
                    { value: 'amount', label: 'Amount ₱' },
                    { value: 'percent', label: 'Percent %' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="discountValue" label="Discount">
                <InputNumber
                  min={0}
                  step={discountType === 'percent' ? 1 : 0.5}
                  max={discountType === 'percent' ? 100 : undefined}
                  prefix={discountType === 'percent' ? '%' : '₱'}
                  placeholder="0"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="docTaxIds"
                label="Taxes"
                tooltip="Fast apply: stamps this selection onto every line. You can still adjust taxes per line afterwards."
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Apply taxes to all lines"
                  optionFilterProp="label"
                  options={taxOptions}
                  onChange={(ids: string[]) => applyTaxesToAll(ids)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="applyTaxAll" valuePropName="checked" style={{ marginTop: -8 }}>
            <Checkbox
              disabled={!hasTax}
              onChange={(e) => applyTaxInToAll(e.target.checked)}
            >
              Prices include tax — apply to all lines
            </Checkbox>
          </Form.Item>

          <div className="form-totals">
            <div className="form-totals__row">
              <span>Subtotal</span>
              <span>{peso(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="form-totals__row">
                <span>Discount</span>
                <span>− {peso(totals.discountAmount)}</span>
              </div>
            )}
            <div className="form-totals__row">
              <span>Gross (before tax)</span>
              <span>{peso(totals.gross)}</span>
            </div>
            {totals.taxBreakdown.length === 0 ? (
              <div className="form-totals__row">
                <span>Tax amount</span>
                <span>{peso(0)}</span>
              </div>
            ) : (
              totals.taxBreakdown.map((t) => (
                <div className="form-totals__row" key={t.label}>
                  <span>{t.label}</span>
                  <span>{peso(t.amount)}</span>
                </div>
              ))
            )}
            {totals.taxBreakdown.length > 1 && (
              <div className="form-totals__row">
                <span>Total tax</span>
                <span>{peso(totals.taxAmount)}</span>
              </div>
            )}
            <div className="form-totals__row is-total">
              <span>Total payable to vendor</span>
              <strong>{peso(totals.total)}</strong>
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
