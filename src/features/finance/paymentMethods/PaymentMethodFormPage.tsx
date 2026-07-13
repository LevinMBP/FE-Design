import { useNavigate } from 'react-router-dom'
import { App, Button, Form, Input, Select } from 'antd'
import { useAddPaymentMethodMutation } from '../financeApi'
import { useGetAccountsQuery } from '../../accounting/accountingApi'
import {
  PAYMENT_METHOD_TYPES,
  type FinanceStatus,
  type PaymentMethodType,
} from '../types'

interface PaymentMethodFormValues {
  name: string
  type: PaymentMethodType
  provider?: string
  accountNumber?: string
  glAccountId: string
  description?: string
  status: FinanceStatus
}

function PaymentMethodFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addPaymentMethod, { isLoading }] = useAddPaymentMethodMutation()
  const { data: accounts } = useGetAccountsQuery()

  const cashAccountOptions = (accounts ?? [])
    .filter((a) => a.type === 'asset')
    .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))

  const onFinish = async (values: PaymentMethodFormValues) => {
    try {
      await addPaymentMethod({
        name: values.name.trim(),
        type: values.type,
        provider: values.provider?.trim() ?? '',
        accountNumber: values.accountNumber?.trim() ?? '',
        glAccountId: values.glAccountId,
        description: values.description?.trim() ?? '',
        status: values.status,
      }).unwrap()
      message.success('Payment method saved.')
      navigate('/finance/payment-methods')
    } catch {
      message.error('Could not save the payment method. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New payment method</h1>
          <p>Add a way customers and vendors pay.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          layout="vertical"
          requiredMark
          initialValues={{ type: 'cash', status: 'active' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. BDO Checking" />
          </Form.Item>

          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={PAYMENT_METHOD_TYPES} />
          </Form.Item>

          <Form.Item name="provider" label="Provider">
            <Input placeholder="e.g. BDO, GCash, Visa" />
          </Form.Item>

          <Form.Item name="accountNumber" label="Account Number">
            <Input placeholder="Account or reference number" />
          </Form.Item>

          <Form.Item
            name="glAccountId"
            label="Draws from account"
            tooltip="The cash or bank GL account this method moves money out of (or into). Payments post against it."
            rules={[{ required: true, message: 'Pick a cash or bank account' }]}
          >
            <Select
              placeholder="Select a cash or bank account"
              options={cashAccountOptions}
            />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>

          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </Form.Item>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Save payment method
            </Button>
            <Button onClick={() => navigate('/finance/payment-methods')}>
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default PaymentMethodFormPage
