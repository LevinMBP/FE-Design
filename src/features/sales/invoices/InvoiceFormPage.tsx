import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, App, Button, Col, DatePicker, Form, Input, Row, Select } from 'antd'
import dayjs from 'dayjs'
import {
  useAddInvoiceMutation,
  useGetInvoicesQuery,
  useGetQuotationsQuery,
} from '../salesDocsApi'
import {
  buildLineInputs,
  stockShortages,
  useSalesFormData,
  type LineFieldValues,
} from '../salesFormShared'
import { dueDateFrom, peso } from '../salesDocMath'
import { INVENTORY_LOCATIONS, PAYMENT_TERMS, type PaymentTerm } from '../types'
import type { Quotation } from '../types'
import ContactFields from '../ContactFields'
import LineItemsField from '../LineItemsField'
import TotalsFooter from '../TotalsFooter'

interface ConvertState {
  quotationId?: string
}

/** A quotation is "pullable" into an invoice once it's live (sent/accepted). */
const isPullable = (q: Quotation) => q.status === 'sent' || q.status === 'accepted'

/** Next reference the store will assign: one past the highest INV-NNNN-YY so far. */
const nextInvoiceRef = (references: string[]) => {
  const top = references.reduce((max, ref) => {
    const n = Number(ref.match(/^INV-(\d+)/)?.[1])
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  const yy = String(new Date().getFullYear()).slice(2)
  return `INV-${String(top + 1).padStart(4, '0')}-${yy}`
}

function InvoiceFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { state } = useLocation()
  const routedQuoteId = (state as ConvertState | null)?.quotationId

  const { items, itemsLoading, itemMeta, customers, taxes } = useSalesFormData()
  const { data: quotations } = useGetQuotationsQuery()
  const { data: invoices } = useGetInvoicesQuery()
  const [addInvoice, { isLoading }] = useAddInvoiceMutation()
  const [form] = Form.useForm()
  const submitStatus = useRef<'draft' | 'sent'>('sent')

  // The quotation this invoice is being pulled from (converts it on save).
  const [quotationId, setQuotationId] = useState<string | undefined>(routedQuoteId)

  const date = Form.useWatch('date', form)
  const term = (Form.useWatch('paymentTerm', form) ?? 'Due on receipt') as PaymentTerm
  const duePreview =
    date && term ? dueDateFrom(term, (date as dayjs.Dayjs).format('YYYY-MM-DD')) : ''

  // Live stock check: which items are short if this invoice is sent.
  const lineValues = Form.useWatch('lines', form) as LineFieldValues[] | undefined
  const shortages = stockShortages(lineValues, items)

  const pullableQuotes = useMemo(
    () => (quotations ?? []).filter(isPullable),
    [quotations],
  )

  // The reference this invoice will get when saved, shown instead of a placeholder.
  const invoiceRef = invoices ? nextInvoiceRef(invoices.map((i) => i.reference)) : ''

  /** Copy a quotation's customer, lines, discount and taxes onto the form. */
  const applyQuote = (q: Quotation) => {
    form.setFieldsValue({
      customerId: q.customerId,
      contactPerson: q.contactPerson,
      email: q.email,
      address: q.address,
      lines: q.lines.map((l) => ({
        item: `${l.itemKind}:${l.itemId}`,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxIds: [...l.taxIds],
        taxIncluded: l.taxIncluded,
      })),
      discountType: q.discountType,
      discountValue: q.discountValue,
      notes: q.notes,
    })
  }

  // Prefill when arriving via the "Convert to invoice" button.
  useEffect(() => {
    if (!routedQuoteId || !quotations) return
    const q = quotations.find((x) => x.id === routedQuoteId)
    if (q) applyQuote(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routedQuoteId, quotations])

  const onPickQuote = (id: string | undefined) => {
    setQuotationId(id)
    if (!id) return
    const q = pullableQuotes.find((x) => x.id === id)
    if (q) applyQuote(q)
  }

  const submitAs = (status: 'draft' | 'sent') => {
    submitStatus.current = status
    form.submit()
  }

  const onFinish = async (values: Record<string, unknown>) => {
    const lines = buildLineInputs(values.lines as never)
    if (lines.length === 0) {
      message.error('Add at least one item with a quantity.')
      return
    }
    const d = (k: string) => (values[k] as dayjs.Dayjs).format('YYYY-MM-DD')
    try {
      const invoice = await addInvoice({
        date: d('date'),
        deliveryReceipt: (values.deliveryReceipt as string)?.trim() ?? '',
        paymentTerm: values.paymentTerm as PaymentTerm,
        location: values.location as string,
        customerId: (values.customerId as string) ?? '',
        contactPerson: (values.contactPerson as string)?.trim() ?? '',
        email: (values.email as string)?.trim() ?? '',
        address: (values.address as string)?.trim() ?? '',
        lines,
        discountType: values.discountType as 'amount' | 'percent',
        discountValue: (values.discountValue as number) ?? 0,
        notes: (values.notes as string)?.trim() ?? '',
        status: submitStatus.current,
        quotationId,
      }).unwrap()
      message.success(
        submitStatus.current === 'sent'
          ? `Invoice ${invoice.reference} sent — stock issued.`
          : `Invoice ${invoice.reference} saved as draft.`,
      )
      navigate('/sales/invoices')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not save. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New invoice</h1>
          <p>Bill a customer. Sending an invoice issues the items out of stock (the sale).</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 860 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            date: dayjs(),
            deliveryReceipt: '',
            paymentTerm: 'Due on receipt',
            location: INVENTORY_LOCATIONS[0],
            lines: [{ taxIds: [], taxIncluded: false }],
            discountType: 'amount',
            discountValue: 0,
            docTaxIds: [],
            applyTaxAll: false,
          }}
          onFinish={onFinish}
        >
          {pullableQuotes.length > 0 && (
            <Form.Item
              label="Start from quotation"
              tooltip="Pull an accepted or sent quotation to fill this invoice, then review."
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Optional — pick a quotation to copy"
                value={quotationId}
                onChange={onPickQuote}
                options={pullableQuotes.map((q) => ({
                  value: q.id,
                  label: `${q.reference} · ${q.customerName || 'No customer'} · ${peso(q.total)}`,
                }))}
              />
            </Form.Item>
          )}

          <div className="form-section__title">Invoice details</div>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Invoice number" tooltip="Assigned automatically on save.">
                <Input disabled value={invoiceRef} placeholder="Auto (INV-###)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="date"
                label="Invoice date"
                rules={[{ required: true, message: 'Invoice date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="deliveryReceipt"
                label="Delivery receipt no."
                tooltip="The delivery receipt reference for this shipment."
              >
                <Input placeholder="e.g. DR-1024" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="paymentTerm"
                label="Payment term"
                rules={[{ required: true }]}
              >
                <Select options={PAYMENT_TERMS.map((t) => ({ value: t, label: t }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="location" label="Inventory location" rules={[{ required: true }]}>
                <Select
                  options={INVENTORY_LOCATIONS.map((l) => ({ value: l, label: l }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Due date" tooltip="Derived from the invoice date and payment term.">
                <Input
                  disabled
                  value={duePreview ? dayjs(duePreview).format('MMM D, YYYY') : ''}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="form-section__title" style={{ margin: '4px 0 16px' }}>
            Customer details
          </div>

          <ContactFields form={form} customers={customers} />

          <div className="form-section__title" style={{ margin: '4px 0 16px' }}>
            Items
          </div>

          <LineItemsField
            form={form}
            items={items}
            itemsLoading={itemsLoading}
            itemMeta={itemMeta}
            taxes={taxes}
          />

          {shortages.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="Not enough stock on hand to send this invoice"
              description={
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {shortages.map((s) => (
                    <li key={s.name}>
                      {s.name}: need {s.need} {s.unit}, have {s.have} {s.unit}
                    </li>
                  ))}
                  <li style={{ listStyle: 'none', marginLeft: -18, marginTop: 4 }}>
                    You can still <strong>Save as draft</strong> and send once
                    stock is received.
                  </li>
                </ul>
              }
            />
          )}

          <TotalsFooter form={form} taxes={taxes} />

          <div className="form-actions">
            <Button
              type="primary"
              loading={isLoading}
              disabled={shortages.length > 0}
              onClick={() => submitAs('sent')}
            >
              Create &amp; send (issues stock)
            </Button>
            <Button loading={isLoading} onClick={() => submitAs('draft')}>
              Save as draft
            </Button>
            <Button onClick={() => navigate('/sales/invoices')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default InvoiceFormPage
