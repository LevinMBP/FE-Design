import { useEffect } from 'react'
import { App, DatePicker, Form, InputNumber, Modal, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useGetPaymentMethodsQuery } from '../finance/financeApi'
import { usePayPurchaseMutation } from '../inventory/inventoryApi'
import type { Purchase } from '../inventory/types'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)
const round2 = (n: number) => Math.round(n * 100) / 100

interface PayValues {
  amount: number
  paymentMethodId: string
  date: Dayjs
}

/** Records a payment against a purchase's payable (Dr AP / Cr cash-or-bank). */
function PayPurchaseModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<PayValues>()
  const { data: methods } = useGetPaymentMethodsQuery()
  const [pay, { isLoading }] = usePayPurchaseMutation()

  const outstanding = purchase ? round2(purchase.netPayable - purchase.amountPaid) : 0

  const methodOptions = (methods ?? [])
    .filter((m) => m.status === 'active')
    .map((m) => ({ value: m.id, label: m.name }))

  useEffect(() => {
    if (purchase) {
      form.setFieldsValue({
        amount: outstanding,
        date: dayjs(),
        paymentMethodId: undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase])

  const onOk = async () => {
    if (!purchase) return
    const values = await form.validateFields()
    try {
      const res = await pay({
        purchaseId: purchase.id,
        paymentMethodId: values.paymentMethodId,
        date: values.date.format('YYYY-MM-DD'),
        amount: values.amount,
      }).unwrap()
      message.success(`Recorded ${peso(res.amount)} — ${res.reference}.`)
      onClose()
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Payment failed.')
    }
  }

  return (
    <Modal
      open={!!purchase}
      title={purchase ? `Pay ${purchase.reference}` : ''}
      okText="Record payment"
      confirmLoading={isLoading}
      onOk={onOk}
      onCancel={onClose}
      destroyOnHidden
    >
      {purchase && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 20,
              flexWrap: 'wrap',
              margin: '4px 0 18px',
              color: 'var(--text-muted)',
            }}
          >
            <span>Vendor: <strong>{purchase.vendorName || '—'}</strong></span>
            <span>Net payable: <strong>{peso(purchase.netPayable)}</strong></span>
            {purchase.amountPaid > 0 && <span>Paid: {peso(purchase.amountPaid)}</span>}
            <span>
              Outstanding: <strong>{peso(outstanding)}</strong>
            </span>
          </div>

          <Form form={form} layout="vertical" requiredMark>
            <Form.Item
              name="amount"
              label="Amount"
              rules={[
                { required: true, message: 'Enter an amount' },
                {
                  validator: (_, v) =>
                    v == null || v <= 0
                      ? Promise.reject(new Error('Amount must be greater than 0'))
                      : v > outstanding + 0.005
                        ? Promise.reject(new Error(`Can't exceed ${peso(outstanding)}`))
                        : Promise.resolve(),
                },
              ]}
            >
              <InputNumber
                min={0}
                max={outstanding}
                step={0.01}
                prefix="₱"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="paymentMethodId"
              label="Payment method"
              rules={[{ required: true, message: 'Select how you paid' }]}
            >
              <Select placeholder="Cash, bank, GCash…" options={methodOptions} />
            </Form.Item>

            <Form.Item
              name="date"
              label="Date"
              rules={[{ required: true, message: 'Date is required' }]}
            >
              <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  )
}

export default PayPurchaseModal
