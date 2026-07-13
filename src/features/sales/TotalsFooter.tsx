import {
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  type FormInstance,
} from 'antd'
import type { Tax } from '../finance/types'
import { computeTotals, peso } from './salesDocMath'
import type { DiscountType } from './types'
import './SalesDocuments.css'

const { TextArea } = Input

interface LineValues {
  quantity?: number
  unitPrice?: number
  taxIncluded?: boolean
}

interface Props {
  form: FormInstance
  taxes: Tax[]
}

/**
 * Discount, tax, and the live money breakdown (Subtotal → Discount → Gross →
 * Tax → Total). The "apply to all lines" checkbox is the fast-track: it stamps
 * every line's tax-included flag; individual lines can still be overridden.
 */
function TotalsFooter({ form, taxes }: Props) {
  const lines = (Form.useWatch('lines', form) ?? []) as LineValues[]
  const discountType = (Form.useWatch('discountType', form) ?? 'amount') as DiscountType
  const discountValue = Form.useWatch('discountValue', form) ?? 0
  const taxId = Form.useWatch('taxId', form) ?? ''

  const tax = taxes.find((t) => t.id === taxId)
  const hasTax = !!tax

  const totals = computeTotals(
    lines.map((l) => ({
      quantity: l?.quantity ?? 0,
      unitPrice: l?.unitPrice ?? 0,
      taxIncluded: !!l?.taxIncluded,
    })),
    discountType,
    discountValue,
    tax,
  )

  const taxOptions = [
    { value: '', label: 'No tax' },
    ...taxes.map((t) => ({
      value: t.id,
      label: `${t.name} ${t.rate}%${t.computation === 'inclusive' ? ' incl.' : ''}`,
    })),
  ]

  const applyToAll = (checked: boolean) => {
    const current = (form.getFieldValue('lines') as LineValues[]) ?? []
    form.setFieldsValue({
      lines: current.map((l) => ({ ...l, taxIncluded: checked })),
    })
  }

  return (
    <>
      <Divider style={{ margin: '20px 0 16px' }}>Discount &amp; tax</Divider>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="discountType" label="Discount type">
            <Segmented
              block
              options={[
                { value: 'amount', label: 'Amount ₱' },
                { value: 'percent', label: 'Percent %' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="discountValue" label="Discount">
            <InputNumber
              min={0}
              step={discountType === 'percent' ? 1 : 0.5}
              max={discountType === 'percent' ? 100 : undefined}
              prefix={discountType === 'percent' ? '%' : '₱'}
              placeholder="0"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="taxId" label="Tax">
            <Select options={taxOptions} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="applyTaxAll" valuePropName="checked" style={{ marginTop: -8 }}>
        <Checkbox
          disabled={!hasTax}
          onChange={(e) => applyToAll(e.target.checked)}
        >
          Prices include tax — apply to all lines
        </Checkbox>
      </Form.Item>

      <Form.Item name="notes" label="Notes">
        <TextArea rows={2} placeholder="Terms, delivery notes, thank-you message…" />
      </Form.Item>

      <div className="salesdoc-totals">
        <TotalRow label="Subtotal" value={peso(totals.subtotal)} />
        {totals.discountAmount > 0 && (
          <TotalRow label="Discount" value={`− ${peso(totals.discountAmount)}`} />
        )}
        <TotalRow label="Gross (before tax)" value={peso(totals.gross)} />
        <TotalRow
          label={
            hasTax
              ? `Tax amount · ${tax!.name} ${tax!.rate}%${
                  tax!.computation === 'inclusive' ? ' (incl.)' : ''
                }`
              : 'Tax amount'
          }
          value={peso(totals.taxAmount)}
        />
        <TotalRow label="Final total" value={peso(totals.total)} strong />
      </div>
    </>
  )
}

/** One line of the totals panel. */
function TotalRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className={`salesdoc-totals__row${strong ? ' is-total' : ''}`}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {strong ? <strong>{value}</strong> : value}
      </span>
    </div>
  )
}

export default TotalsFooter
