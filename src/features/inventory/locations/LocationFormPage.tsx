import { useNavigate } from 'react-router-dom'
import { App, Button, Col, Form, Input, Row, Select } from 'antd'
import { useAddLocationMutation } from '../inventoryApi'
import {
  LOCATION_TYPE_OPTIONS,
  type LocationStatus,
  type LocationType,
} from '../types'

const { TextArea } = Input

interface LocationFormValues {
  name: string
  code?: string
  type: LocationType
  address?: string
  description?: string
  status: LocationStatus
}

function LocationFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addLocation, { isLoading }] = useAddLocationMutation()

  const onFinish = async (values: LocationFormValues) => {
    try {
      await addLocation({
        name: values.name.trim(),
        code: values.code?.trim() ?? '',
        type: values.type,
        address: values.address?.trim() ?? '',
        description: values.description?.trim() ?? '',
        status: values.status,
      }).unwrap()
      message.success('Location saved.')
      navigate('/inventory/locations')
    } catch {
      message.error('Could not save the location. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New location</h1>
          <p>Add a warehouse or storage place for your stock.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          layout="vertical"
          requiredMark="optional"
          initialValues={{ type: 'warehouse', status: 'active' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. Main Warehouse" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Code"
                tooltip="A short identifier shown on documents and the stock ledger — e.g. WH-MAIN."
              >
                <Input placeholder="e.g. WH-MAIN" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select options={LOCATION_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="Address">
            <Input placeholder="Street, city…" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Notes about this location…" />
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
              Save location
            </Button>
            <Button onClick={() => navigate('/inventory/locations')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default LocationFormPage
