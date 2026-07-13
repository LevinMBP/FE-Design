import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Col, Form, InputNumber, Row, Skeleton } from 'antd'
import { ArrowLeft } from 'lucide-react'
import {
  useGetCompensationsQuery,
  useUpdateCompensationMutation,
} from '../payrollApi'
import { formatPeso } from '../types'

interface CompensationFormValues {
  basicPay: number
  allowance: number
}

const pesoField = {
  min: 0,
  step: 500,
  style: { width: '100%' },
  formatter: (value?: string | number) =>
    `₱ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  parser: (value?: string) => Number((value ?? '').replace(/[₱,\s]/g, '')) || 0,
} as const

function CompensationFormPage() {
  const { employeeId = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data: rows, isLoading } = useGetCompensationsQuery()
  const [updateCompensation, { isLoading: isSaving }] =
    useUpdateCompensationMutation()
  const [form] = Form.useForm<CompensationFormValues>()

  const row = rows?.find((r) => r.employeeId === employeeId)

  const basicPay = Form.useWatch('basicPay', form) ?? row?.basicPay ?? 0
  const allowance = Form.useWatch('allowance', form) ?? row?.allowance ?? 0
  const gross = basicPay + allowance

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  if (!row) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Employee not found</h1>
            <p>This employee has no active record on payroll.</p>
          </div>
          <Button
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/payroll/compensation')}
          >
            Back to compensation
          </Button>
        </div>
      </div>
    )
  }

  const onFinish = async (values: CompensationFormValues) => {
    try {
      await updateCompensation({
        employeeId: row.employeeId,
        basicPay: values.basicPay ?? 0,
        allowance: values.allowance ?? 0,
      }).unwrap()
      message.success(`Compensation updated for ${row.employeeName}.`)
      navigate('/payroll/compensation')
    } catch {
      message.error('Could not update compensation. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Edit compensation</h1>
          <p>
            {row.employeeName}
            {row.position ? ` · ${row.position}` : ''}
          </p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ basicPay: row.basicPay, allowance: row.allowance }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="basicPay"
                label="Monthly basic pay"
                rules={[{ required: true, message: 'Basic pay is required' }]}
              >
                <InputNumber {...pesoField} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="allowance" label="Monthly allowance">
                <InputNumber {...pesoField} />
              </Form.Item>
            </Col>
          </Row>

          <p className="text-tertiary" style={{ marginTop: -4, marginBottom: 20 }}>
            Monthly gross: <strong>{formatPeso(gross)}</strong> — deductions are
            computed automatically on each pay run.
          </p>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Save compensation
            </Button>
            <Button onClick={() => navigate('/payroll/compensation')}>
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default CompensationFormPage
