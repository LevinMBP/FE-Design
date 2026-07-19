import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useAddProductMutation, useGetMaterialsQuery } from '../inventoryApi'
import { PRODUCT_TYPE_LABELS, type ProductType } from '../types'
import { skuFromName } from '../sku'

interface RecipeLineValues {
  materialId?: string
  quantityPerUnit?: number
}

interface ProductFormValues {
  name: string
  sku?: string
  noSku?: boolean
  type: ProductType
  price: number
  packaging?: string
  recipe?: RecipeLineValues[]
}

const TYPE_OPTIONS = (Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map(
  (t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }),
)

function ProductFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [addProduct, { isLoading }] = useAddProductMutation()
  const { data: materials } = useGetMaterialsQuery()
  const [form] = Form.useForm<ProductFormValues>()
  const type = Form.useWatch('type', form)
  const noSku = Form.useWatch('noSku', form)
  const name = Form.useWatch('name', form)

  const isManufactured = type === 'manufactured'

  const materialOptions = (materials ?? []).map((m) => ({
    value: m.id,
    label: `${m.name} · ${m.unit}`,
  }))

  // Keep the (disabled) SKU field showing the generated slug while "No SKU" is on.
  useEffect(() => {
    if (noSku) form.setFieldValue('sku', skuFromName(name ?? ''))
  }, [noSku, name, form])

  const onTypeChange = (value: ProductType) => {
    if (value === 'manufactured') {
      const recipe = form.getFieldValue('recipe') as RecipeLineValues[] | undefined
      if (!recipe || recipe.length === 0) form.setFieldValue('recipe', [{}])
    }
  }

  const onFinish = async (values: ProductFormValues) => {
    let recipe: { materialId: string; quantityPerUnit: number }[] | undefined
    if (values.type === 'manufactured') {
      recipe = (values.recipe ?? [])
        .filter((l) => l?.materialId && (l.quantityPerUnit ?? 0) > 0)
        .map((l) => ({
          materialId: l.materialId as string,
          quantityPerUnit: l.quantityPerUnit as number,
        }))
      if (recipe.length === 0) {
        message.error('Add at least one raw material for a manufactured product.')
        return
      }
      const ids = recipe.map((l) => l.materialId)
      if (new Set(ids).size !== ids.length) {
        message.error('Each raw material can only be listed once.')
        return
      }
    }

    try {
      await addProduct({
        name: values.name.trim(),
        sku: values.noSku ? skuFromName(values.name) : (values.sku ?? '').trim(),
        type: values.type,
        price: values.price,
        packaging: values.packaging?.trim() ?? '',
        recipe,
      }).unwrap()
      message.success('Product saved.')
      navigate('/inventory/products')
    } catch {
      message.error('Could not save the product. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New product</h1>
          <p>Add an imported, local-purchase or manufactured product.</p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 560 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{ type: 'imported', quantity: 0 }}
          onFinish={onFinish}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. Steel Cabinet" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sku"
                label="SKU"
                rules={noSku ? [] : [{ required: true, message: 'SKU is required' }]}
              >
                <Input placeholder="PRD-XXX" disabled={noSku} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select options={TYPE_OPTIONS} onChange={onTypeChange} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="noSku" valuePropName="checked" style={{ marginTop: -8 }}>
            <Checkbox>No SKU — generate one from the name</Checkbox>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Price"
                rules={[{ required: true, message: 'Enter a price' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  prefix="$"
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <p className="form-note" style={{ marginTop: 0 }}>
            New products start at <strong>0 on hand</strong>.{' '}
            {isManufactured
              ? 'Build stock on the Manufacturing page.'
              : 'Load existing stock (with FIFO batch costs) on the Opening Balances page, or receive it through Purchases.'}
          </p>

          <Form.Item
            name="packaging"
            label="Packaging"
            tooltip="How this product is packed for selling and storing — e.g. Box, Crate, Pack of 10, Flat-pack carton. Keeps ordering and counting consistent."
          >
            <Input placeholder="e.g. Box, Crate, Pack of 10" />
          </Form.Item>

          {isManufactured && (
            <>
              <div className="form-section__title" style={{ marginTop: 4 }}>
                Bill of materials
              </div>
              <p className="form-note" style={{ marginTop: 0 }}>
                Raw materials consumed to produce one unit. Manufacturing will
                deduct these from stock.
              </p>

              <Form.List name="recipe">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name: fname, ...rest }) => (
                      <div key={key} className="line-card line-card--row">
                        <Row gutter={12} align="middle">
                          <Col flex="auto">
                            <Form.Item
                              {...rest}
                              name={[fname, 'materialId']}
                              rules={[{ required: true, message: 'Select a material' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                showSearch
                                optionFilterProp="label"
                                placeholder="Raw material"
                                options={materialOptions}
                              />
                            </Form.Item>
                          </Col>
                          <Col flex="130px">
                            <Form.Item
                              {...rest}
                              name={[fname, 'quantityPerUnit']}
                              rules={[{ required: true, message: 'Qty' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                min={0}
                                step={1}
                                placeholder="Qty / unit"
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                          </Col>
                          <Col flex="32px">
                            <Button
                              type="text"
                              danger
                              aria-label="Remove material"
                              icon={<Trash2 size={16} />}
                              disabled={fields.length === 1}
                              onClick={() => remove(fname)}
                            />
                          </Col>
                        </Row>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({})}
                      icon={<Plus size={16} />}
                      style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
                    >
                      Add material
                    </Button>
                  </>
                )}
              </Form.List>
            </>
          )}

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Save product
            </Button>
            <Button onClick={() => navigate('/inventory/products')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default ProductFormPage
