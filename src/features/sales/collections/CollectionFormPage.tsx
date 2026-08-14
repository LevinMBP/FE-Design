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
  useAddCollectionMutation,
  useGetInvoicesQuery,
  useGetNextCollectionRefQuery,
} from '../salesDocsApi'
import { useGetSalesQuery } from '../../inventory/inventoryApi'
import { useGetCustomersQuery } from '../../contacts/contactsApi'
import { useGetPaymentMethodsQuery, useGetTaxesQuery } from '../../finance/financeApi'
import AllocationTable from '../../../shared/components/AllocationTable'
import {
  allocateOldestFirst,
  allocatedTotal,
  round2,
  withholdingFor,
  type AllocatableDoc,
} from '../../../shared/settlement'
import { openReceivables } from '../receivables'
import type { OpenReceivable, ReceivableKind } from '../types'
import '../../../shared/styles/settlement.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

interface FormValues {
  date: Dayjs
  customerId: string
  paymentMethodId: string
  withholdingTaxId?: string
  note: string
}

/** `kind:id` — receivables come from two stores, so ids alone aren't unique. */
const keyOf = (r: { kind: ReceivableKind; id: string }) => `${r.kind}:${r.id}`

const KIND_BADGE: Record<ReceivableKind, { label: string; color: string }> = {
  invoice: { label: 'Invoice', color: 'geekblue' },
  sale: { label: 'Sales Order', color: 'purple' },
}

const toDoc = (r: OpenReceivable): AllocatableDoc => ({
  key: keyOf(r),
  reference: r.reference,
  date: r.date,
  dueDate: r.dueDate || undefined,
  badge: KIND_BADGE[r.kind],
  total: r.total,
  netBase: r.netBase,
  amountPaid: r.amountPaid,
  outstanding: r.outstanding,
})

/**
 * Record a customer collection: customer → allocation → invoice / sales order.
 *
 * The mirror of a vendor payment. Pick who paid, how, and when; that customer's
 * open documents load below and the receipt is split across them. Both invoices
 * and sales orders show up, because both debit Accounts Receivable when booked.
 * Opening with `?invoice=<id>` or `?sale=<id>` pre-fills that document in full.
 */
function CollectionFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const preselect = params.get('invoice')
    ? { kind: 'invoice' as const, id: params.get('invoice')! }
    : params.get('sale')
      ? { kind: 'sale' as const, id: params.get('sale')! }
      : null
  const [form] = Form.useForm<FormValues>()

  const { data: customers, isLoading: customersLoading } = useGetCustomersQuery()
  const { data: methods } = useGetPaymentMethodsQuery()
  const { data: taxes } = useGetTaxesQuery()
  const { data: invoices, isLoading: invoicesLoading } = useGetInvoicesQuery()
  const { data: sales, isLoading: salesLoading } = useGetSalesQuery()
  const { data: nextRef } = useGetNextCollectionRefQuery()
  const [addCollection, { isLoading }] = useAddCollectionMutation()

  const customerId: string | undefined = Form.useWatch('customerId', form)
  const withholdingTaxId: string | undefined = Form.useWatch('withholdingTaxId', form)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [withheld, setWithheld] = useState<Record<string, number>>({})
  const [tender, setTender] = useState<number | null>(null)
  const prefilled = useRef(false)
  const docsLoading = invoicesLoading || salesLoading

  // Only taxes that post to a creditable-WHT account can be withheld on a sale.
  const whtTaxes = (taxes ?? []).filter(
    (t) => t.status === 'active' && t.accounts.some((a) => a.purpose === 'wht_receivable'),
  )
  const whtTax = whtTaxes.find((t) => t.id === withholdingTaxId)
  const whtRate = whtTax?.rate ?? 0

  const customerOptions = (customers ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => ({ value: c.id, label: c.company }))

  const methodOptions = (methods ?? [])
    .filter((m) => m.status === 'active')
    .map((m) => ({ value: m.id, label: m.name }))

  /** Every open receivable, so the prefill can find one before a customer is set. */
  const allOpen = useMemo(
    () => openReceivables(invoices ?? [], sales ?? []),
    [invoices, sales],
  )

  const docs = useMemo(
    () => (customerId ? allOpen.filter((r) => r.customerId === customerId).map(toDoc) : []),
    [allOpen, customerId],
  )

  // Fast-track from the invoices / sales orders list.
  useEffect(() => {
    if (prefilled.current || !preselect || allOpen.length === 0) return
    const doc = allOpen.find((r) => r.kind === preselect.kind && r.id === preselect.id)
    if (!doc) return
    prefilled.current = true
    form.setFieldValue('customerId', doc.customerId)
    setAmounts({ [keyOf(doc)]: doc.outstanding })
  }, [allOpen, form, preselect])

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
        `${peso(unallocated)} could not be allocated — it's more than this customer owes.`,
      )
    }
  }

  const onFinish = async (values: FormValues) => {
    const allocations = docs
      .map((d) => {
        const [docKind, docId] = d.key.split(':') as [ReceivableKind, string]
        return {
          docKind,
          docId,
          amount: round2(amounts[d.key] ?? 0),
          withholdingTax: round2(withheld[d.key] ?? 0),
        }
      })
      .filter((a) => a.amount > 0)
    if (allocations.length === 0) {
      message.error('Allocate the collection to at least one document.')
      return
    }

    try {
      const collection = await addCollection({
        date: values.date.format('YYYY-MM-DD'),
        customerId: values.customerId,
        paymentMethodId: values.paymentMethodId,
        withholdingTaxId: values.withholdingTaxId,
        note: values.note ?? '',
        allocations,
      }).unwrap()
      message.success(
        collection.withholdingTotal > 0
          ? `${collection.reference} — ${peso(collection.cashAmount)} received, ${peso(
              collection.withholdingTotal,
            )} withheld, ${peso(collection.amount)} settled.`
          : `${collection.reference} — ${peso(collection.amount)} collected across ${
              collection.allocations.length
            } document${collection.allocations.length === 1 ? '' : 's'}.`,
      )
      navigate('/sales/collections')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not record the collection.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New collection</h1>
          <p>
            Receive money from a customer and allocate it across their open
            invoices and sales orders. The collection clears Accounts Receivable
            into the cash or bank account behind the payment method.
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
              Collection details {nextRef && <span className="text-tertiary">· {nextRef}</span>}
            </div>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="customerId"
                  label="Customer"
                  rules={[{ required: true, message: 'Pick a customer' }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Who paid you?"
                    loading={customersLoading}
                    options={customerOptions}
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
                  label="Received through"
                  tooltip="The cash or bank account the money lands in"
                  rules={[{ required: true, message: 'Select how they paid' }]}
                >
                  <Select placeholder="Cash, bank, GCash…" options={methodOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="date"
                  label="Date received"
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
                  label="Tax withheld by customer"
                  tooltip="Tax the customer held back and remitted for you (their BIR 2307). It clears the receivable but arrives as a creditable asset, not cash."
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    allowClear
                    placeholder="None"
                    options={whtTaxes.map((t) => ({
                      value: t.id,
                      label: `${t.name} ${t.rate}%`,
                    }))}
                    notFoundContent="No creditable withholding taxes — add one under Finance › Taxes."
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item name="note" label="Note" style={{ marginBottom: 0 }}>
                  <Input.TextArea
                    rows={2}
                    placeholder="Cheque number, deposit slip reference…"
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div className="form-section__title">Allocate to open documents</div>

          {!customerId ? (
            <div className="settle-empty">
              Pick a customer to load their open invoices and sales orders.
            </div>
          ) : (
            <>
              <div className="settle-toolbar">
                <div className="settle-toolbar__field">
                  <span className="settle-toolbar__label">Amount received</span>
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
                  Auto-allocate settles the oldest documents first. You can always
                  override any row{whtTax ? ', including its withholding' : ''}.
                </span>
              </div>

              {docs.length === 0 && !docsLoading && (
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Nothing outstanding"
                  description="This customer has no unpaid invoices or sales orders."
                />
              )}

              <AllocationTable
                docs={docs}
                amounts={amounts}
                onChange={setAmount}
                loading={docsLoading}
                emptyText="No open documents for this customer."
                amountLabel="This collection"
                withholding={
                  whtTax
                    ? {
                        amounts: withheld,
                        onChange: setWithholding,
                        label: `${whtTax.name} ${whtTax.rate}%`,
                        netLabel: 'Net cash received',
                      }
                    : undefined
                }
              />
            </>
          )}

          <div className="form-totals">
            <div className="form-totals__row">
              <span>Customer owes</span>
              <span>{peso(openTotal)}</span>
            </div>
            <div className="form-totals__row">
              <span>Receivables settled</span>
              <span>{peso(total)}</span>
            </div>
            {whtTotal > 0 && (
              <div className="form-totals__row">
                <span>
                  Less tax withheld{whtTax ? ` (${whtTax.name} ${whtTax.rate}%)` : ''}
                </span>
                <span>− {peso(whtTotal)}</span>
              </div>
            )}
            <div className="form-totals__row is-total">
              <span>Cash received</span>
              <strong>{peso(cashTotal)}</strong>
            </div>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading} disabled={total <= 0}>
              Record collection
            </Button>
            <Button onClick={() => navigate('/sales/collections')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default CollectionFormPage
