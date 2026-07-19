import {
  Checkbox,
  Col,
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

const { TextArea } = Input

interface LineValues {
  quantity?: number
  unitPrice?: number
  taxIds?: string[]
  taxIncluded?: boolean
}

interface Props {
  form: FormInstance
  taxes: Tax[]
}

/**
 * Discount, tax fast-apply, and the live money breakdown (Subtotal → Discount
 * → Gross → per-tax rows → Total). Taxes live on the lines; the "Taxes" picker
 * here is the fast-track that stamps every line's tax selection, and the
 * checkbox stamps every line's tax-included flag. Individual lines can still
 * be overridden afterwards.
 */
function TotalsFooter({ form, taxes }: Props) {
  const lines = (Form.useWatch('lines', form) ?? []) as LineValues[]
  const discountType = (Form.useWatch('discountType', form) ?? 'amount') as DiscountType
  const discountValue = Form.useWatch('discountValue', form) ?? 0
  const docTaxIds = (Form.useWatch('docTaxIds', form) ?? []) as string[]

  const hasTax =
    docTaxIds.length > 0 || lines.some((l) => (l?.taxIds?.length ?? 0) > 0)

  const totals = computeTotals(
    lines.map((l) => ({
      quantity: l?.quantity ?? 0,
      unitPrice: l?.unitPrice ?? 0,
      taxIds: l?.taxIds ?? [],
      taxIncluded: !!l?.taxIncluded,
    })),
    discountType,
    discountValue,
    taxes,
  )

  const taxOptions = taxes.map((t) => ({
    value: t.id,
    label: `${t.name} ${t.rate}%`,
  }))

  const applyTaxesToAll = (taxIds: string[]) => {
    const current = (form.getFieldValue('lines') as LineValues[]) ?? []
    form.setFieldsValue({
      lines: current.map((l) => ({ ...l, taxIds: [...taxIds] })),
    })
  }

  const applyToAll = (checked: boolean) => {
    const current = (form.getFieldValue('lines') as LineValues[]) ?? []
    form.setFieldsValue({
      lines: current.map((l) => ({ ...l, taxIncluded: checked })),
    })
  }

  return (
    <>
      <div className="form-section__title" style={{ margin: '20px 0 16px' }}>
        Discount &amp; tax
      </div>

      <Row gutter={16}>
        <Col xs={24} sm={12} md={8}>
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
        <Col xs={24} sm={12} md={8}>
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
        <Col xs={24} sm={12} md={8}>
          <Form.Item
            name="docTaxIds"
            label="Taxes"
            tooltip="Fast apply: stamps this selection onto every line. You can still adjust taxes per line afterwards."
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Apply taxes to all lines"
              optionFilterProp="label"
              options={taxOptions}
              onChange={(ids: string[]) => applyTaxesToAll(ids)}
            />
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

      <div className="form-totals">
        <TotalRow label="Subtotal" value={peso(totals.subtotal)} />
        {totals.discountAmount > 0 && (
          <TotalRow label="Discount" value={`− ${peso(totals.discountAmount)}`} />
        )}
        <TotalRow label="Gross (before tax)" value={peso(totals.gross)} />
        {totals.taxBreakdown.length === 0 ? (
          <TotalRow label="Tax amount" value={peso(0)} />
        ) : (
          totals.taxBreakdown.map((t) => (
            <TotalRow key={t.label} label={t.label} value={peso(t.amount)} />
          ))
        )}
        {totals.taxBreakdown.length > 1 && (
          <TotalRow label="Total tax" value={peso(totals.taxAmount)} />
        )}
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
    <div className={`form-totals__row${strong ? ' is-total' : ''}`}>
      <span>{label}</span>
      <span>{strong ? <strong>{value}</strong> : value}</span>
    </div>
  )
}

export default TotalsFooter
