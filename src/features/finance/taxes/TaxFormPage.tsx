import { useNavigate } from 'react-router-dom'
import { App, Button, Form, Input, InputNumber, Select } from 'antd'
import { useAddTaxMutation } from '../financeApi'
import {
  TAX_APPLIES_TO,
  TAX_COMPUTATIONS,
  type FinanceStatus,
  type TaxAppliesTo,
  type TaxComputation,
} from '../types'

interface TaxFormValues {
  name: string
  rate: number
  computation: TaxComputation
  appliesTo: TaxAppliesTo
  description?: string
  status: FinanceStatus
}

function TaxFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addTax, { isLoading }] = useAddTaxMutation()

  const onFinish = async (values: TaxFormValues) => {
    try {
      await addTax({
        name: values.name.trim(),
        rate: values.rate ?? 0,
        computation: values.computation,
        appliesTo: values.appliesTo,
        description: values.description?.trim() ?? '',
        status: values.status,
      }).unwrap()
      message.success('Tax saved.')
      navigate('/finance/taxes')
    } catch {
      message.error('Could not save the tax. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New tax</h1>
          <p>Add a tax rate and how it applies.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          layout="vertical"
          requiredMark
          initialValues={{
            rate: 0,
            computation: 'exclusive',
            appliesTo: 'both',
            status: 'active',
          }}
          onFinish={onFinish}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. VAT" />
          </Form.Item>

          <Form.Item
            name="rate"
            label="Rate (%)"
            rules={[{ required: true, message: 'Rate is required' }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={0.5}
              addonAfter="%"
              style={{ width: '100%' }}
              placeholder="0"
            />
          </Form.Item>

          <Form.Item
            name="computation"
            label="Computation"
            rules={[{ required: true }]}
          >
            <Select options={TAX_COMPUTATIONS} />
          </Form.Item>

          <Form.Item
            name="appliesTo"
            label="Applies To"
            rules={[{ required: true }]}
          >
            <Select options={TAX_APPLIES_TO} />
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
              Save tax
            </Button>
            <Button onClick={() => navigate('/finance/taxes')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default TaxFormPage
