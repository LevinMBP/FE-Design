import { useEffect, useMemo, useRef, useState } from 'react'
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
  Row,
  Select,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useAddVendorPaymentMutation,
  useGetNextPaymentRefQuery,
  useGetPurchasesQuery,
} from '../../inventory/inventoryApi'
import { useGetVendorsQuery } from '../../contacts/contactsApi'
import { useGetPaymentMethodsQuery, useGetTaxesQuery } from '../../finance/financeApi'
import AllocationTable from '../../../shared/components/AllocationTable'
import {
  allocateOldestFirst,
  allocatedTotal,
  isOpen,
  outstandingOf,
  round2,
  withholdingFor,
  type AllocatableDoc,
} from '../../../shared/settlement'
import type { Purchase } from '../../inventory/types'
import '../../../shared/styles/settlement.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

interface FormValues {
  date: Dayjs
  vendorId: string
  paymentMethodId: string
  withholdingTaxId?: string
  note: string
}

const toDoc = (p: Purchase): AllocatableDoc => ({
  key: p.id,
  reference: p.reference,
  date: p.date,
  dueDate: p.dueDate || undefined,
  total: p.netPayable,
  // `gross` is the discounted, tax-exclusive value — the base EWT is due on.
  netBase: p.gross,
  amountPaid: p.amountPaid,
  outstanding: outstandingOf(p.netPayable, p.amountPaid),
})

/**
 * Record a vendor payment: vendor → allocation → purchase order.
 *
 * Pick who was paid, how, and on what date; the open purchase orders for that
 * vendor load below and the payment is split across them. The document total is
 * always the sum of the allocations, so money can never go out unapplied. Enter
 * a lump sum and "Auto-allocate" to fill the oldest orders first, or type the
 * amounts per order. Opening with `?purchase=<id>` pre-fills that order in full.
 */
function PaymentFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const purchaseId = params.get('purchase') ?? undefined
  const [form] = Form.useForm<FormValues>()

  const { data: vendors, isLoading: vendorsLoading } = useGetVendorsQuery()
  const { data: methods } = useGetPaymentMethodsQuery()
  const { data: taxes } = useGetTaxesQuery()
  const { data: purchases, isLoading: purchasesLoading } = useGetPurchasesQuery()
  const { data: nextRef } = useGetNextPaymentRefQuery()
  const [addPayment, { isLoading }] = useAddVendorPaymentMutation()

  const vendorId: string | undefined = Form.useWatch('vendorId', form)
  const withholdingTaxId: string | undefined = Form.useWatch('withholdingTaxId', form)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [withheld, setWithheld] = useState<Record<string, number>>({})
  const [tender, setTender] = useState<number | null>(null)
  const prefilled = useRef(false)

  // Only taxes that actually post to a WHT payable account can be withheld.
  const whtTaxes = (taxes ?? []).filter(
    (t) => t.status === 'active' && t.accounts.some((a) => a.purpose === 'wht_payable'),
  )
  const whtTax = whtTaxes.find((t) => t.id === withholdingTaxId)
  const whtRate = whtTax?.rate ?? 0

  const vendorOptions = (vendors ?? [])
    .filter((v) => v.status === 'active')
    .map((v) => ({ value: v.id, label: v.company }))

  const methodOptions = (methods ?? [])
    .filter((m) => m.status === 'active')
    .map((m) => ({ value: m.id, label: m.name }))

  /** This vendor's still-unpaid orders, oldest first. */
  const docs = useMemo(() => {
    if (!vendorId) return []
    return (purchases ?? [])
      .filter((p) => p.vendorId === vendorId && isOpen(p.netPayable, p.amountPaid))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(toDoc)
  }, [purchases, vendorId])

  // Fast-track from the purchases list: preselect the vendor and pay that order.
  useEffect(() => {
    if (prefilled.current || !purchaseId || !purchases) return
    const purchase = purchases.find((p) => p.id === purchaseId)
    if (!purchase) return
    prefilled.current = true
    form.setFieldValue('vendorId', purchase.vendorId)
    const outstanding = outstandingOf(purchase.netPayable, purchase.amountPaid)
    if (outstanding > 0) setAmounts({ [purchase.id]: outstanding })
  }, [form, purchaseId, purchases])

  /** Withholding for every allocated row at the current rate. */
  const recomputeWithholding = (next: Record<string, number>, rate: number) => {
    const out: Record<string, number> = {}
    for (const doc of docs) {
      const applied = next[doc.key] ?? 0
      if (applied > 0 && rate > 0) out[doc.key] = withholdingFor(doc, applied, rate)
    }
    return out
  }

  // Changing the withholding tax re-rates every line that already has an amount.
  useEffect(() => {
    setWithheld((prev) =>
      Object.keys(prev).length === 0 && whtRate === 0
        ? prev
        : recomputeWithholding(amounts, whtRate),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whtRate])

  const setAmount = (key: string, amount: number) => {
    setAmounts((prev) => ({ ...prev, [key]: amount }))
    // Re-derive this row's tax from the new amount; it stays editable after.
    const doc = docs.find((d) => d.key === key)
    if (doc) {
      setWithheld((prev) => ({
        ...prev,
        [key]: whtRate > 0 ? withholdingFor(doc, amount, whtRate) : 0,
      }))
    }
  }

  const setWithholding = (key: string, amount: number) =>
    setWithheld((prev) => ({ ...prev, [key]: amount }))

  const clearAll = () => {
    setAmounts({})
    setWithheld({})
  }

  const total = allocatedTotal(amounts)
  const whtTotal = allocatedTotal(withheld)
  const cashTotal = round2(total - whtTotal)
  const openTotal = round2(docs.reduce((s, d) => s + d.outstanding, 0))

  const autoAllocate = () => {
    const { amounts: next, unallocated } = allocateOldestFirst(docs, tender ?? 0)
    setAmounts(next)
    setWithheld(recomputeWithholding(next, whtRate))
    if (unallocated > 0) {
      message.warning(
        `${peso(unallocated)} could not be allocated — it's more than this vendor is owed.`,
      )
    }
  }

  const onFinish = async (values: FormValues) => {
    const allocations = docs
      .map((d) => ({
        purchaseId: d.key,
        amount: round2(amounts[d.key] ?? 0),
        withholdingTax: round2(withheld[d.key] ?? 0),
      }))
      .filter((a) => a.amount > 0)
    if (allocations.length === 0) {
      message.error('Allocate the payment to at least one purchase order.')
      return
    }

    try {
      const payment = await addPayment({
        date: values.date.format('YYYY-MM-DD'),
        vendorId: values.vendorId,
        paymentMethodId: values.paymentMethodId,
        withholdingTaxId: values.withholdingTaxId,
        note: values.note ?? '',
        allocations,
      }).unwrap()
      message.success(
        payment.withholdingTotal > 0
          ? `${payment.reference} — ${peso(payment.cashAmount)} paid, ${peso(
              payment.withholdingTotal,
            )} withheld, ${peso(payment.amount)} settled.`
          : `${payment.reference} — ${peso(payment.amount)} paid across ${
              payment.allocations.length
            } order${payment.allocations.length === 1 ? '' : 's'}.`,
      )
      navigate('/purchases/payments')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Payment failed.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New vendor payment</h1>
          <p>
            Pay a vendor and allocate the money across their open purchase
            orders. The payment clears Accounts Payable and draws from the cash
            or bank account behind the payment method.
          </p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 1100 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ date: dayjs(), note: '' }}
          onFinish={onFinish}
        >
          <div className="form-section">
            <div className="form-section__title">
              Payment details {nextRef && <span className="text-tertiary">· {nextRef}</span>}
            </div>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="vendorId"
                  label="Vendor"
                  rules={[{ required: true, message: 'Pick a vendor' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Who are you paying?"
                    loading={vendorsLoading}
                    options={vendorOptions}
                    onChange={() => {
                      clearAll()
                      setTender(null)
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="paymentMethodId"
                  label="Payment method"
                  tooltip="The cash or bank account the money leaves from"
                  rules={[{ required: true, message: 'Select how you paid' }]}
                >
                  <Select placeholder="Cash, bank, GCash…" options={methodOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="date"
                  label="Payment date"
                  rules={[{ required: true, message: 'Date is required' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="withholdingTaxId"
                  label="Withholding tax"
                  tooltip="Tax you withhold from the vendor and remit to the BIR. Each row's tax is computed on the order's net-of-VAT share and stays editable."
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    allowClear
                    placeholder="None"
                    options={whtTaxes.map((t) => ({
                      value: t.id,
                      label: `${t.name} ${t.rate}%`,
                    }))}
                    notFoundContent="No withholding taxes — add one under Finance › Taxes."
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item name="note" label="Note" style={{ marginBottom: 0 }}>
                  <Input.TextArea
                    rows={2}
                    placeholder="Cheque number, remittance reference…"
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="form-section__title">Allocate to purchase orders</div>

          {!vendorId ? (
            <div className="settle-empty">
              Pick a vendor to load their open purchase orders.
            </div>
          ) : (
            <>
              <div className="settle-toolbar">
                <div className="settle-toolbar__field">
                  <span className="settle-toolbar__label">Amount paid</span>
                  <InputNumber
                    value={tender}
                    min={0}
                    step={0.01}
                    prefix="₱"
                    placeholder="0.00"
                    style={{ width: 180 }}
                    onChange={(v) => setTender(v == null ? null : Number(v))}
                    onPressEnter={autoAllocate}
                  />
                </div>
                <Button onClick={autoAllocate} disabled={!tender || docs.length === 0}>
                  Auto-allocate
                </Button>
                <Button onClick={clearAll} disabled={total === 0}>
                  Clear
                </Button>
                <span className="settle-toolbar__hint">
                  Auto-allocate fills the oldest orders first. You can always
                  override any row{whtTax ? ', including its withholding' : ''}.
                </span>
              </div>

              {docs.length === 0 && !purchasesLoading && (
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Nothing outstanding"
                  description="Every purchase order for this vendor is fully paid."
                />
              )}

              <AllocationTable
                docs={docs}
                amounts={amounts}
                onChange={setAmount}
                loading={purchasesLoading}
                emptyText="No open purchase orders for this vendor."
                withholding={
                  whtTax
                    ? {
                        amounts: withheld,
                        onChange: setWithholding,
                        label: `${whtTax.name} ${whtTax.rate}%`,
                        netLabel: 'Net cash paid',
                      }
                    : undefined
                }
              />
            </>
          )}

          <div className="form-totals">
            <div className="form-totals__row">
              <span>Vendor owes</span>
              <span>{peso(openTotal)}</span>
            </div>
            <div className="form-totals__row">
              <span>Payables settled</span>
              <span>{peso(total)}</span>
            </div>
            {whtTotal > 0 && (
              <div className="form-totals__row">
                <span>Less withholding tax{whtTax ? ` (${whtTax.name} ${whtTax.rate}%)` : ''}</span>
                <span>− {peso(whtTotal)}</span>
              </div>
            )}
            <div className="form-totals__row is-total">
              <span>Cash leaving {whtTotal > 0 ? 'the account' : ''}</span>
              <strong>{peso(cashTotal)}</strong>
            </div>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading} disabled={total <= 0}>
              Record payment
            </Button>
            <Button onClick={() => navigate('/purchases/payments')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default PaymentFormPage
