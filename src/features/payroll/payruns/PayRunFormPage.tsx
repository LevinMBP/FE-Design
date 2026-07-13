import { useNavigate } from 'react-router-dom'
import { App, Alert, Button, Col, Form, Row, Select } from 'antd'
import { useCreatePayRunMutation } from '../payrollApi'
import { MONTHS } from '../types'

interface PayRunFormValues {
  month: number // 1-12
  year: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Last calendar day of a 1-based month/year — used as the default pay date. */
function lastDayOfMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function derivePeriod(month: number, year: number) {
  const period = `${year}-${pad(month)}`
  const periodLabel = `${MONTHS[month - 1]} ${year}`
  const payDate = `${year}-${pad(month)}-${pad(lastDayOfMonth(month, year))}`
  return { period, periodLabel, payDate }
}

function PayRunFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [createPayRun, { isLoading }] = useCreatePayRunMutation()

  const now = new Date()
  const currentYear = now.getFullYear()
  const [form] = Form.useForm<PayRunFormValues>()
  const month = Form.useWatch('month', form) ?? now.getMonth() + 1
  const year = Form.useWatch('year', form) ?? currentYear
  const preview = derivePeriod(month, year)

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({
    value: y,
    label: String(y),
  }))

  const onFinish = async (values: PayRunFormValues) => {
    const derived = derivePeriod(values.month, values.year)
    try {
      const run = await createPayRun(derived).unwrap()
      message.success(`Pay run for ${derived.periodLabel} generated.`)
      navigate(`/payroll/pay-runs/${run.id}`)
    } catch (err) {
      message.error(
        typeof err === 'string' ? err : 'Could not generate the pay run.',
      )
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New pay run</h1>
          <p>Pick a period — payslips are generated for all active employees.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ month: now.getMonth() + 1, year: currentYear }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="month"
                label="Month"
                rules={[{ required: true, message: 'Select a month' }]}
              >
                <Select
                  options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="year"
                label="Year"
                rules={[{ required: true, message: 'Select a year' }]}
              >
                <Select options={yearOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
            message={`Pay date: ${new Date(preview.payDate).toLocaleDateString(
              'en-PH',
              { year: 'numeric', month: 'long', day: 'numeric' },
            )}`}
            description="Defaults to the last day of the selected month. Active employees are included automatically."
          />

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Generate pay run
            </Button>
            <Button onClick={() => navigate('/payroll/pay-runs')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default PayRunFormPage
