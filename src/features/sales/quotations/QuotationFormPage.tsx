import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Col, DatePicker, Divider, Form, Row } from 'antd'
import dayjs from 'dayjs'
import { useAddQuotationMutation } from '../salesDocsApi'
import { buildLineInputs, useSalesFormData } from '../salesFormShared'
import ContactFields from '../ContactFields'
import LineItemsField from '../LineItemsField'
import TotalsFooter from '../TotalsFooter'

function QuotationFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { items, itemsLoading, itemMeta, customers, taxes } = useSalesFormData()
  const [addQuotation, { isLoading }] = useAddQuotationMutation()
  const [form] = Form.useForm()
  const submitStatus = useRef<'draft' | 'sent'>('sent')

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
        taxId: (values.taxId as string) ?? '',
        notes: (values.notes as string)?.trim() ?? '',
        status: submitStatus.current,
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

      <div className="form-shell" style={{ maxWidth: 860 }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            date: dayjs(),
            effectiveDate: dayjs(),
            expiryDate: dayjs().add(3, 'month'),
            lines: [{ taxIncluded: false }],
            discountType: 'amount',
            discountValue: 0,
            taxId: '',
            applyTaxAll: false,
          }}
          onFinish={onFinish}
        >
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

          <Divider style={{ margin: '4px 0 16px' }}>Items</Divider>

          <LineItemsField
            form={form}
            items={items}
            itemsLoading={itemsLoading}
            itemMeta={itemMeta}
            showDetails
          />

          <TotalsFooter form={form} taxes={taxes} />

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
    </div>
  )
}

export default QuotationFormPage
