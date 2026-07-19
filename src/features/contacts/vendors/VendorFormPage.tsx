import { useNavigate } from 'react-router-dom'
import { App, Button, Col, Form, Input, InputNumber, Row, Select } from 'antd'
import { useAddVendorMutation } from '../contactsApi'
import type { ContactStatus } from '../types'

interface VendorFormValues {
  company: string
  email?: string
  contactPerson?: string
  contactNumber?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  latitude: number
  longitude: number
  status: ContactStatus
}

function VendorFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addVendor, { isLoading }] = useAddVendorMutation()

  const onFinish = async (values: VendorFormValues) => {
    try {
      await addVendor({
        company: values.company.trim(),
        email: values.email?.trim() ?? '',
        contactPerson: values.contactPerson?.trim() ?? '',
        contactNumber: values.contactNumber?.trim() ?? '',
        addressLine1: values.addressLine1?.trim() ?? '',
        addressLine2: values.addressLine2?.trim() ?? '',
        city: values.city?.trim() ?? '',
        state: values.state?.trim() ?? '',
        postalCode: values.postalCode?.trim() ?? '',
        country: values.country?.trim() ?? '',
        latitude: values.latitude ?? 0,
        longitude: values.longitude ?? 0,
        status: values.status,
      }).unwrap()
      message.success('Vendor saved.')
      navigate('/purchases/vendors')
    } catch {
      message.error('Could not save the vendor. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New vendor</h1>
          <p>Add a supplier you purchase from.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          layout="vertical"
          requiredMark
          initialValues={{ status: 'active', latitude: 0, longitude: 0 }}
          onFinish={onFinish}
        >
          <Form.Item
            name="company"
            label="Company"
            rules={[{ required: true, message: 'Company is required' }]}
          >
            <Input placeholder="Company" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Enter a valid email' }]}
          >
            <Input placeholder="Email" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactPerson" label="Contact Person">
                <Input placeholder="Contact Person" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactNumber" label="Contact Number">
                <Input placeholder="Contact Number" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="addressLine1" label="Address Line 1">
            <Input placeholder="Address Line 1" />
          </Form.Item>

          <Form.Item name="addressLine2" label="Address Line 2">
            <Input placeholder="Address Line 2" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label="State">
                <Input placeholder="State" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="postalCode" label="Postal Code">
                <Input placeholder="Postal Code" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label="Country">
                <Input placeholder="Country" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="latitude" label="Latitude">
                <InputNumber step={0.0001} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longitude" label="Longitude">
                <InputNumber step={0.0001} style={{ width: '100%' }} placeholder="0" />
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
              Save vendor
            </Button>
            <Button onClick={() => navigate('/purchases/vendors')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default VendorFormPage
