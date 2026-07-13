import { useNavigate } from 'react-router-dom'
import { App, Button, Form, Input, InputNumber, Select } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useAddTaxMutation } from '../financeApi'
import { useGetAccountsQuery } from '../../accounting/accountingApi'
import {
  TAX_ACCOUNT_PURPOSES,
  type FinanceStatus,
  type TaxAccountPurpose,
} from '../types'

interface TaxAccountValues {
  glAccountId: string
  purpose: TaxAccountPurpose
}

interface TaxFormValues {
  name: string
  rate: number
  description?: string
  status: FinanceStatus
  accounts: TaxAccountValues[]
}

const purposeOptions = TAX_ACCOUNT_PURPOSES.map((p) => ({
  value: p.value,
  label: `${p.label} · ${p.hint}`,
}))

function TaxFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addTax, { isLoading }] = useAddTaxMutation()
  const { data: accounts } = useGetAccountsQuery()
  const [form] = Form.useForm<TaxFormValues>()

  const accountOptions = (accounts ?? []).map((a) => ({
    value: a.id,
    label: `${a.code} · ${a.name}`,
  }))

  const watchedAccounts = (Form.useWatch('accounts', form) as TaxAccountValues[]) ?? []

  const purposeOptionsFor = (rowIndex: number) => {
    const takenElsewhere = new Set(
      watchedAccounts
        .filter((_, i) => i !== rowIndex)
        .map((a) => a?.purpose)
        .filter(Boolean),
    )
    return purposeOptions.filter(
      (o) => !takenElsewhere.has(o.value) || o.value === watchedAccounts[rowIndex]?.purpose,
    )
  }

  const onFinish = async (values: TaxFormValues) => {
    try {
      await addTax({
        name: values.name.trim(),
        rate: values.rate ?? 0,
        description: values.description?.trim() ?? '',
        status: values.status,
        accounts: values.accounts ?? [],
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
          <p>Add a tax rate and the GL accounts it posts to.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 640 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            rate: 0,
            status: 'active',
            accounts: [{}],
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

          <Form.Item
            label="GL accounts"
            tooltip="The account this tax posts to for each side of a transaction. Add one row per purpose — e.g. Input Tax for purchases and Output Tax for sales on a standard VAT."
          >
            <Form.List
              name="accounts"
              rules={[
                {
                  validator: async (_, accounts: TaxAccountValues[]) => {
                    if (!accounts || accounts.length < 1) {
                      throw new Error('Add at least one GL account')
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Form.Item
                        {...rest}
                        name={[name, 'purpose']}
                        rules={[{ required: true, message: 'Purpose is required' }]}
                        style={{ marginBottom: 0, flex: '0 0 220px' }}
                      >
                        <Select placeholder="Purpose" options={purposeOptionsFor(name)} />
                      </Form.Item>
                      <Form.Item
                        {...rest}
                        name={[name, 'glAccountId']}
                        rules={[{ required: true, message: 'GL account is required' }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="GL account"
                          options={accountOptions}
                        />
                      </Form.Item>
                      <Button
                        type="text"
                        aria-label="Remove GL account"
                        icon={<Trash2 size={16} />}
                        disabled={fields.length === 1}
                        onClick={() => remove(name)}
                      />
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    icon={<Plus size={16} />}
                    style={{ width: '100%' }}
                  >
                    Add GL account
                  </Button>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
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
