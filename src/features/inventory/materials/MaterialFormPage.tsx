import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Checkbox, Col, Form, Input, InputNumber, Row, Select } from 'antd'
import { useAddMaterialMutation } from '../inventoryApi'
import { UNITS } from '../units'
import { skuFromName } from '../sku'

const { TextArea } = Input

interface MaterialFormValues {
  name: string
  sku?: string
  noSku?: boolean
  unit: string
  minStock: number
  maxStock: number
  packaging?: string
  description?: string
}

function MaterialFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addMaterial, { isLoading }] = useAddMaterialMutation()
  const [form] = Form.useForm<MaterialFormValues>()
  const noSku = Form.useWatch('noSku', form)
  const name = Form.useWatch('name', form)

  // Keep the (disabled) SKU field showing the generated slug while "No SKU" is on.
  useEffect(() => {
    if (noSku) form.setFieldValue('sku', skuFromName(name ?? ''))
  }, [noSku, name, form])

  const onFinish = async (values: MaterialFormValues) => {
    try {
      await addMaterial({
        name: values.name.trim(),
        sku: values.noSku ? skuFromName(values.name) : (values.sku ?? '').trim(),
        unit: values.unit,
        minStock: values.minStock,
        maxStock: values.maxStock,
        packaging: values.packaging?.trim() ?? '',
        description: values.description?.trim() ?? '',
      }).unwrap()
      message.success('Material saved.')
      navigate('/inventory/materials')
    } catch {
      message.error('Could not save the material. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New material</h1>
          <p>Add a raw material to your inventory.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
          <Form
            form={form}
            layout="vertical"
            requiredMark="optional"
            initialValues={{ unit: 'pc' }}
            onFinish={onFinish}
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Name is required' }]}
            >
              <Input placeholder="e.g. Steel Sheet" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="sku"
                  label="SKU"
                  rules={noSku ? [] : [{ required: true, message: 'SKU is required' }]}
                >
                  <Input placeholder="MAT-XXX" disabled={noSku} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                  <Select
                    options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="noSku" valuePropName="checked" style={{ marginTop: -8 }}>
              <Checkbox>No SKU — generate one from the name</Checkbox>
            </Form.Item>

            <p className="form-note" style={{ marginTop: 0 }}>
              New materials start at <strong>0 on hand</strong>. Load existing stock
              (with FIFO batch costs) on the{' '}
              <a onClick={() => navigate('/inventory/opening-balances')}>
                Opening Balances
              </a>{' '}
              page, or receive it through Purchases.
            </p>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="minStock"
                  label="Minimum stock"
                  rules={[{ required: true, message: 'Enter a minimum' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="maxStock"
                  label="Maximum stock"
                  dependencies={['minStock']}
                  rules={[
                    { required: true, message: 'Enter a maximum' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (value == null || value >= getFieldValue('minStock')) {
                          return Promise.resolve()
                        }
                        return Promise.reject(
                          new Error('Max stock must be ≥ min stock'),
                        )
                      },
                    }),
                  ]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="packaging"
              label="Packaging"
              tooltip="How this material is packed for buying and storing — e.g. Box of 100, 20 kg sack, 1 L can. Keeps ordering and counting consistent."
            >
              <Input placeholder="e.g. Box of 100, Pallet, Can" />
            </Form.Item>

            <Form.Item name="description" label="Description">
              <TextArea rows={3} placeholder="Notes about this material…" />
            </Form.Item>

            <div className="form-actions">
              <Button type="primary" htmlType="submit" loading={isLoading}>
                Save material
              </Button>
              <Button onClick={() => navigate('/inventory/materials')}>Cancel</Button>
            </div>
          </Form>
        </div>
    </div>
  )
}

export default MaterialFormPage
