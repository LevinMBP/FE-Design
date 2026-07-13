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
  Tag,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { useAddJournalEntryMutation, useGetAccountsQuery } from '../accountingApi'
import { formatPeso } from '../types'

interface LineValues {
  accountId?: string
  debit?: number
  credit?: number
}

interface FormValues {
  date: Dayjs
  memo?: string
  lines: LineValues[]
}

const pesoInput = {
  min: 0,
  step: 100,
  style: { width: '100%' as const },
  formatter: (v?: string | number) => (v ? `₱ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''),
  parser: (v?: string) => Number((v ?? '').replace(/[₱,\s]/g, '')) || 0,
}

function JournalEntryFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data: accounts } = useGetAccountsQuery()
  const [addEntry, { isLoading }] = useAddJournalEntryMutation()
  const [form] = Form.useForm<FormValues>()
  const lines = Form.useWatch('lines', form) ?? []

  const options = (accounts ?? []).map((a) => ({
    value: a.id,
    label: `${a.code} · ${a.name}`,
  }))

  const totalDebit = lines.reduce((s, l) => s + (l?.debit ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l?.credit ?? 0), 0)
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100
  const balanced = diff === 0 && totalDebit > 0

  // A line is a debit OR a credit — entering one zeroes the other.
  const onAmount = (name: number, field: 'debit' | 'credit', value: number | null) => {
    const next = form.getFieldValue('lines') as LineValues[]
    if (value && value > 0) {
      next[name] = { ...next[name], [field]: value, [field === 'debit' ? 'credit' : 'debit']: 0 }
      form.setFieldsValue({ lines: next })
    }
  }

  const onFinish = async (values: FormValues) => {
    const usable = (values.lines ?? []).filter(
      (l) => l?.accountId && ((l.debit ?? 0) > 0 || (l.credit ?? 0) > 0),
    )
    try {
      const entry = await addEntry({
        date: values.date.format('YYYY-MM-DD'),
        memo: values.memo ?? '',
        lines: usable.map((l) => ({
          accountId: l.accountId as string,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
        })),
      }).unwrap()
      message.success(`Entry ${entry.reference} posted.`)
      navigate('/accounting/journal')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not post the entry.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New journal entry</h1>
          <p>Add debit and credit lines — the entry posts only when they balance.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 780 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ date: dayjs(), lines: [{}, {}] }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="memo" label="Memo">
                <Input placeholder="What is this entry for?" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }}>Lines</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row gutter={12} key={key} align="middle" style={{ marginBottom: 4 }}>
                    <Col span={11}>
                      <Form.Item
                        {...rest}
                        name={[name, 'accountId']}
                        rules={[{ required: true, message: 'Select an account' }]}
                      >
                        <Select showSearch optionFilterProp="label" placeholder="Account" options={options} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...rest} name={[name, 'debit']}>
                        <InputNumber
                          {...pesoInput}
                          placeholder="Debit"
                          onChange={(v) => onAmount(name, 'debit', v as number | null)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...rest} name={[name, 'credit']}>
                        <InputNumber
                          {...pesoInput}
                          placeholder="Credit"
                          onChange={(v) => onAmount(name, 'credit', v as number | null)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                      <Button
                        type="text"
                        aria-label="Remove line"
                        icon={<Trash2 size={16} />}
                        disabled={fields.length <= 2}
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
                  Add line
                </Button>
              </>
            )}
          </Form.List>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 20,
              margin: '18px 0',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              Debits <strong>{formatPeso(totalDebit)}</strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Credits <strong>{formatPeso(totalCredit)}</strong>
            </span>
            <Tag color={balanced ? 'green' : 'red'}>
              {balanced ? 'Balanced' : `Off by ${formatPeso(Math.abs(diff))}`}
            </Tag>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading} disabled={!balanced}>
              Post entry
            </Button>
            <Button onClick={() => navigate('/accounting/journal')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default JournalEntryFormPage
