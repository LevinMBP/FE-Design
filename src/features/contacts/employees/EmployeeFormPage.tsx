import { useNavigate } from 'react-router-dom'
import { App, Button, Col, Form, Input, Row, Select } from 'antd'
import { useAddEmployeeMutation } from '../contactsApi'
import { DEPARTMENTS, type ContactStatus } from '../types'

interface EmployeeFormValues {
  name: string
  position?: string
  department: string
  email: string
  phone?: string
  status: ContactStatus
}

function EmployeeFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addEmployee, { isLoading }] = useAddEmployeeMutation()

  const onFinish = async (values: EmployeeFormValues) => {
    try {
      await addEmployee({
        name: values.name.trim(),
        position: values.position?.trim() ?? '',
        department: values.department,
        email: values.email.trim(),
        phone: values.phone?.trim() ?? '',
        status: values.status,
      }).unwrap()
      message.success('Employee saved.')
      navigate('/finance/employees')
    } catch {
      message.error('Could not save the employee. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New employee</h1>
          <p>Add a team member.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          layout="vertical"
          requiredMark="optional"
          initialValues={{ status: 'active', department: 'Operations' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="name"
            label="Full name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. Gabriel Ong" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position" label="Position">
                <Input placeholder="e.g. Warehouse Lead" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department"
                label="Department"
                rules={[{ required: true }]}
              >
                <Select
                  options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input placeholder="name@venturo.ph" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+63 917 000 0000" />
              </Form.Item>
            </Col>
          </Row>

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
              Save employee
            </Button>
            <Button onClick={() => navigate('/finance/employees')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default EmployeeFormPage
