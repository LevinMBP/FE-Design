import { Button, Col, Form, InputNumber, Row, type FormInstance } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { resolveOpeningLots, type OpeningLotInput } from './openingLots'

interface Props {
  /** The parent form instance, used to watch the running total. */
  form: FormInstance
  /** Form.List name path for the lot rows (relative within any parent list). */
  name: (string | number)[]
  /** Absolute path from the form root to the same rows — for the live summary. */
  watchPath: (string | number)[]
  /** Label for the per-lot quantity column (e.g. "kg", "pc", "units"). */
  unitLabel?: string
}

const money = (n: number) => `$${n.toFixed(2)}`

/**
 * Opening-stock cost layers (FIFO batches): a small table of quantity + unit
 * cost rows. Oldest batch first — FIFO issues them in this order. Shows a live
 * "total on hand · weighted-avg cost" summary. Bind under a Form.List `name`;
 * used inside the Opening Balance document (one instance per item line).
 */
function OpeningLotsTable({ form, name, watchPath, unitLabel = 'units' }: Props) {
  const rows = Form.useWatch<OpeningLotInput[]>(watchPath, form)
  const resolved = resolveOpeningLots(rows)

  return (
    <>
      <p className="form-note" style={{ marginTop: 0, marginBottom: 8 }}>
        <strong>Order matters.</strong> The first batch you add is the first one
        sold (FIFO), so put your <strong>oldest stock at the top</strong> and work
        down to the newest.
      </p>

      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name: fname, ...rest }, index) => (
              <Row gutter={12} key={key} align="middle" style={{ marginBottom: 8 }}>
                <Col
                  flex="76px"
                  title={
                    index === 0
                      ? 'Oldest batch — sold first'
                      : `Batch ${index + 1} — sold after the ones above`
                  }
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--color-text-secondary, #6b7280)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {index === 0 ? '#1 · oldest' : `#${index + 1}`}
                </Col>
                <Col flex="auto">
                  <Form.Item
                    {...rest}
                    name={[fname, 'quantity']}
                    rules={[{ required: true, message: 'Qty' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      placeholder={`Qty (${unitLabel})`}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col flex="auto">
                  <Form.Item
                    {...rest}
                    name={[fname, 'unitCost']}
                    rules={[{ required: true, message: 'Unit cost' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0}
                      step={0.01}
                      prefix="$"
                      placeholder="Unit cost"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col flex="32px">
                  <Button
                    type="text"
                    danger
                    aria-label="Remove batch"
                    icon={<Trash2 size={16} />}
                    disabled={fields.length === 1}
                    onClick={() => remove(fname)}
                  />
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              onClick={() => add({})}
              icon={<Plus size={16} />}
              style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
            >
              Add batch
            </Button>
          </>
        )}
      </Form.List>

      <p className="form-note" style={{ margin: '0 0 8px' }}>
        {resolved
          ? `Total on hand: ${resolved.quantity} ${unitLabel} · weighted-avg cost ${money(resolved.unitCost)}`
          : 'Total on hand: 0'}
      </p>
    </>
  )
}

export default OpeningLotsTable
