import { Col, Form, Input, Row, Select, type FormInstance } from 'antd'
import type { Customer } from '../contacts/types'
import { formatAddress } from './salesFormShared'

const { TextArea } = Input

interface Props {
  form: FormInstance
  customers: Customer[]
}

/**
 * Customer picker plus a contact block (person / email / address) that
 * auto-fills from the chosen customer but stays editable per document.
 */
function ContactFields({ form, customers }: Props) {
  const onCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id)
    if (!c) return
    form.setFieldsValue({
      contactPerson: c.contactPerson,
      email: c.email,
      address: formatAddress(c),
    })
  }

  return (
    <>
      <Form.Item
        name="customerId"
        label="Customer"
        rules={[{ required: true, message: 'Customer is required' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Select a customer"
          onChange={onCustomer}
          options={customers.map((c) => ({ value: c.id, label: c.company }))}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="contactPerson" label="Contact person">
            <Input placeholder="Auto-filled from customer" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="email" label="Email">
            <Input placeholder="Auto-filled from customer" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="address" label="Address">
        <TextArea rows={2} placeholder="Auto-filled from customer" />
      </Form.Item>
    </>
  )
}

export default ContactFields
