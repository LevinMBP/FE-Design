import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Row,
  Select,
} from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useAddOpeningBalanceMutation,
  useGetLocationsQuery,
  useGetMaterialsQuery,
  useGetProductsQuery,
} from '../inventoryApi'
import OpeningLotsTable from '../OpeningLotsTable'
import { validLots, type OpeningLotInput } from '../openingLots'
import type { OpeningBalanceLine, StockItemKind } from '../types'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

interface LineValues {
  item?: string // "kind:id"
  lots?: OpeningLotInput[]
}

interface FormValues {
  date: Dayjs
  location: string
  lines: LineValues[]
}

/**
 * Opening Balance document — load a client's existing stock at go-live. Each row
 * is one item plus its FIFO cost layers (qty + unit cost, oldest-first). Posting
 * creates the opening movements, sets on-hand, and books
 * Dr Inventory / Cr Opening Balance Equity. This is the only place opening stock
 * is entered; the item forms no longer take a quantity.
 */
function OpeningBalancePage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const { data: materials, isLoading: matLoading } = useGetMaterialsQuery()
  const { data: products, isLoading: prodLoading } = useGetProductsQuery()
  const { data: locations } = useGetLocationsQuery()
  const [addOpeningBalance, { isLoading }] = useAddOpeningBalanceMutation()
  const lineValues = Form.useWatch('lines', form) ?? []

  const locationOptions = (locations ?? [])
    .filter((l) => l.status === 'active')
    .map((l) => ({ value: l.name, label: l.code ? `${l.name} (${l.code})` : l.name }))

  // Default to the first active location once they load.
  useEffect(() => {
    if (!form.getFieldValue('location') && locationOptions.length > 0) {
      form.setFieldValue('location', locationOptions[0].value)
    }
  }, [form, locationOptions])

  // Combined material + product picker, keyed by "kind:id".
  const { itemOptions, unitOf } = useMemo(() => {
    const unitOf = new Map<string, string>()
    const options = [
      ...(materials ?? []).map((m) => {
        const value = `material:${m.id}`
        unitOf.set(value, m.unit)
        return { value, label: `${m.name} (${m.sku}) · material` }
      }),
      ...(products ?? []).map((p) => {
        const value = `product:${p.id}`
        unitOf.set(value, 'ea')
        return { value, label: `${p.name} (${p.sku}) · product` }
      }),
    ]
    return { itemOptions: options, unitOf }
  }, [materials, products])

  const totalValue = lineValues.reduce((sum, l) => {
    const lots = validLots(l?.lots)
    return sum + lots.reduce((s, x) => s + x.quantity * x.unitCost, 0)
  }, 0)

  const onFinish = async (values: FormValues) => {
    const lines: OpeningBalanceLine[] = []
    for (const l of values.lines ?? []) {
      const lots = validLots(l?.lots)
      if (!l?.item || lots.length === 0) continue
      const [kind, id] = l.item.split(':')
      lines.push({ kind: kind as StockItemKind, itemId: id, lots })
    }
    if (lines.length === 0) {
      message.error('Add at least one item with a batch (quantity and unit cost).')
      return
    }

    try {
      const result = await addOpeningBalance({
        date: values.date.format('YYYY-MM-DD'),
        location: values.location.trim() || 'MAIN WAREHOUSE',
        lines,
      }).unwrap()
      message.success(
        `Opening balance posted — ${result.itemsPosted} item(s), ${peso(result.totalValue)}.`,
      )
      navigate('/inventory/stock')
    } catch (err) {
      message.error(
        typeof err === 'string' ? err : 'Could not post the opening balance.',
      )
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Opening balances</h1>
          <p>
            Load stock you already hold at go-live. Enter each item's FIFO batches
            (oldest first); on-hand and value are set from the batches, and the
            books post Dr Inventory / Cr Opening Balance Equity.
          </p>
        </div>
      </div>

      <div className="form-shell" style={{ maxWidth: 720 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            date: dayjs(),
            lines: [{ lots: [{}] }],
          }}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="location"
                label="Location"
                tooltip="Where this stock physically sits. Applies to every item in this document."
                rules={[{ required: true, message: 'Location is required' }]}
              >
                <Select
                  placeholder="Select a location"
                  options={locationOptions}
                  notFoundContent="No active locations — add one under Locations."
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }}>Items</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => {
                  const selected = lineValues[name]?.item
                  const unitLabel = (selected && unitOf.get(selected)) || 'units'
                  return (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 12 }}
                      styles={{ body: { paddingBottom: 4 } }}
                    >
                      <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
                        <Col flex="auto">
                          <Form.Item
                            {...rest}
                            name={[name, 'item']}
                            style={{ marginBottom: 0 }}
                            rules={[{ required: true, message: 'Select an item' }]}
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              placeholder="Material or product"
                              loading={matLoading || prodLoading}
                              options={itemOptions}
                            />
                          </Form.Item>
                        </Col>
                        <Col flex="32px">
                          <Button
                            aria-label="Remove item"
                            icon={<Trash2 size={16} />}
                            disabled={fields.length === 1}
                            onClick={() => remove(name)}
                            danger
                            shape="circle"
                          />
                        </Col>
                      </Row>

                      <OpeningLotsTable
                        form={form}
                        name={[name, 'lots']}
                        watchPath={['lines', name, 'lots']}
                        unitLabel={unitLabel}
                      />
                    </Card>
                  )
                })}
                <Button
                  type="dashed"
                  onClick={() => add({ lots: [{}] })}
                  icon={<Plus size={16} />}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  Add item
                </Button>
              </>
            )}
          </Form.List>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              margin: '18px 0',
              fontSize: 16,
            }}
          >
            <span style={{ marginRight: 12, color: 'var(--text-muted)' }}>
              Opening inventory value
            </span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
              {peso(totalValue)}
            </strong>
          </div>

          <div className="form-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Post opening balance
            </Button>
            <Button onClick={() => navigate('/inventory/stock')}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default OpeningBalancePage
