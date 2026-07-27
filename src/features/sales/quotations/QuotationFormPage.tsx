import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Col, DatePicker, Form, Input, Row } from 'antd'
import dayjs from 'dayjs'
import { useGetQuotationTemplateQuery } from '../../admin/adminApi'
import { useAddQuotationMutation } from '../salesDocsApi'
import { buildLineInputs, useSalesFormData } from '../salesFormShared'
import type { SignatureBlock } from '../types'
import ContactFields from '../ContactFields'
import LineItemsField from '../LineItemsField'
import TotalsFooter from '../TotalsFooter'
import SignaturePad from '../../../shared/components/SignaturePad'
import QuotationPreview from './QuotationPreview'
import './QuotationDetail.css'

function QuotationFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { items, itemsLoading, itemMeta, customers, taxes } = useSalesFormData()
  const { data: template } = useGetQuotationTemplateQuery()
  const [addQuotation, { isLoading }] = useAddQuotationMutation()
  const [form] = Form.useForm()
  const submitStatus = useRef<'draft' | 'sent'>('sent')

  // Seed the Notes field from the admin-managed default terms (once, if empty).
  useEffect(() => {
    if (template?.defaultTerms && !form.getFieldValue('notes')) {
      form.setFieldValue('notes', template.defaultTerms)
    }
  }, [template, form])

  const submitAs = (status: 'draft' | 'sent') => {
    submitStatus.current = status
    form.submit()
  }

  const onFinish = async (values: Record<string, unknown>) => {
    const lines = buildLineInputs(values.lines as never)
    if (lines.length === 0) {
      message.error('Add at least one item with a quantity.')
      return
    }
    const d = (k: string) => (values[k] as dayjs.Dayjs).format('YYYY-MM-DD')
    const sig = (v: unknown): SignatureBlock | undefined => {
      const block = v as Partial<SignatureBlock> | undefined
      const name = block?.name?.trim() ?? ''
      const signature = block?.signature ?? ''
      return name || signature ? { name, signature } : undefined
    }
    try {
      const quote = await addQuotation({
        date: d('date'),
        effectiveDate: d('effectiveDate'),
        expiryDate: d('expiryDate'),
        customerId: (values.customerId as string) ?? '',
        contactPerson: (values.contactPerson as string)?.trim() ?? '',
        email: (values.email as string)?.trim() ?? '',
        address: (values.address as string)?.trim() ?? '',
        lines,
        discountType: values.discountType as 'amount' | 'percent',
        discountValue: (values.discountValue as number) ?? 0,
        notes: (values.notes as string)?.trim() ?? '',
        status: submitStatus.current,
        preparedBy: sig(values.preparedBy),
        approvedBy: sig(values.approvedBy),
      }).unwrap()
      message.success(`Quotation ${quote.reference} saved.`)
      navigate('/sales/quotations')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not save. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>New quotation</h1>
          <p>A price offer for a customer. No stock is affected until it becomes an invoice.</p>
        </div>
      </div>

      <div className="quote-editor">
        <div className="form-shell quote-editor__form">
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            date: dayjs(),
            effectiveDate: dayjs(),
            expiryDate: dayjs().add(3, 'month'),
            lines: [{ taxIds: [], taxIncluded: false }],
            discountType: 'amount',
            discountValue: 0,
            docTaxIds: [],
            applyTaxAll: false,
          }}
          onFinish={onFinish}
        >
          <div className="form-section__title">Quotation details</div>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="effectiveDate"
                label="Effective date"
                rules={[{ required: true, message: 'Effective date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="expiryDate"
                label="Expiry date"
                tooltip="Defaults to 3 months from the quotation date."
                rules={[{ required: true, message: 'Expiry date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="MMM D, YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <ContactFields form={form} customers={customers} />

          <div className="form-section__title" style={{ margin: '4px 0 16px' }}>
            Items
          </div>

          <LineItemsField
            form={form}
            items={items}
            itemsLoading={itemsLoading}
            itemMeta={itemMeta}
            taxes={taxes}
            showDetails
          />

          <TotalsFooter form={form} taxes={taxes} />

          <div className="form-section__title" style={{ margin: '16px 0 16px' }}>
            Signatures
          </div>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name={['preparedBy', 'name']} label="Prepared by">
                <Input placeholder="Name" />
              </Form.Item>
              <Form.Item name={['preparedBy', 'signature']}>
                <SignaturePad height={140} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name={['approvedBy', 'name']} label="Approved by">
                <Input placeholder="Name" />
              </Form.Item>
              <Form.Item name={['approvedBy', 'signature']}>
                <SignaturePad height={140} />
              </Form.Item>
            </Col>
          </Row>

          <div className="form-actions">
            <Button type="primary" loading={isLoading} onClick={() => submitAs('sent')}>
              Create &amp; mark sent
            </Button>
            <Button loading={isLoading} onClick={() => submitAs('draft')}>
              Save as draft
            </Button>
            <Button onClick={() => navigate('/sales/quotations')}>Cancel</Button>
          </div>
        </Form>
        </div>

        <aside className="quote-editor__preview">
          <div className="quote-editor__preview-head">
            Live preview
            <span>Updates as you type — this is what prints/exports.</span>
          </div>
          <QuotationPreview
            form={form}
            items={items}
            itemMeta={itemMeta}
            customers={customers}
            taxes={taxes}
          />
        </aside>
      </div>
    </div>
  )
}

export default QuotationFormPage
