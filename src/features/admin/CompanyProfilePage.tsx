import { useEffect, useState } from 'react'
import { App, Button, Card, Col, Form, Input, Row, Select, Upload } from 'antd'
import { Upload as UploadIcon, X } from 'lucide-react'
import { useGetCompanyQuery, useUpdateCompanyMutation } from './adminApi'
import type { CompanyProfile } from './mockCompany'
import './admin.css'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'SGD']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MAX_BYTES = 512 * 1024 // 512 KB — kept small since it lives in localStorage.

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

/** A single image upload with preview + remove, storing a base64 data URI. */
function ImageField({
  label,
  hint,
  value,
  variant,
  onChange,
}: {
  label: string
  hint: string
  value?: string
  variant: 'logo' | 'icon'
  onChange: (dataUri: string | undefined) => void
}) {
  const { message } = App.useApp()

  const beforeUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Please choose an image file.')
      return Upload.LIST_IGNORE
    }
    if (file.size > MAX_BYTES) {
      message.error('Image must be 512 KB or smaller.')
      return Upload.LIST_IGNORE
    }
    try {
      onChange(await readAsDataUrl(file))
    } catch {
      message.error('Could not read that image.')
    }
    return false // prevent AntD from uploading anywhere
  }

  return (
    <div className="company-brand">
      <div className={`company-brand__preview company-brand__preview--${variant}`}>
        {value ? (
          <img src={value} alt={`${label} preview`} />
        ) : (
          <span className="company-brand__placeholder">No {label.toLowerCase()}</span>
        )}
      </div>
      <div className="company-brand__meta">
        <div className="company-brand__label">{label}</div>
        <div className="company-brand__hint">{hint}</div>
        <div className="company-brand__actions">
          <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload}>
            <Button size="small" icon={<UploadIcon size={14} />}>
              {value ? 'Replace' : 'Upload'}
            </Button>
          </Upload>
          {value && (
            <Button size="small" type="text" danger icon={<X size={14} />} onClick={() => onChange(undefined)}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CompanyProfilePage() {
  const { data: company, isLoading } = useGetCompanyQuery()
  const [updateCompany, { isLoading: isSaving }] = useUpdateCompanyMutation()
  const { message } = App.useApp()
  const [form] = Form.useForm<CompanyProfile>()
  const [logo, setLogo] = useState<string | undefined>(undefined)
  const [icon, setIcon] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (company) {
      form.setFieldsValue(company)
      setLogo(company.logo)
      setIcon(company.icon)
    }
  }, [company, form])

  const onFinish = async (values: CompanyProfile) => {
    try {
      await updateCompany({ ...values, logo: logo ?? '', icon: icon ?? '' }).unwrap()
      message.success('Company profile saved.')
    } catch {
      message.error('Could not save the company profile.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Company</h1>
          <p>Your business identity, branding and org-wide defaults.</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, display: 'grid', gap: 16 }}>
        <Card title="Branding" loading={isLoading}>
          <div style={{ display: 'grid', gap: 18 }}>
            <ImageField
              label="Logo"
              hint="Shown across the app. Wide image, PNG or SVG. Max 512 KB."
              value={logo}
              variant="logo"
              onChange={setLogo}
            />
            <ImageField
              label="Icon"
              hint="Square app mark, also used as the browser tab favicon. Max 512 KB."
              value={icon}
              variant="icon"
              onChange={setIcon}
            />
          </div>
        </Card>

        <Card title="Company profile" loading={isLoading}>
          <Form form={form} layout="vertical" requiredMark onFinish={onFinish}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="Display name" rules={[{ required: true, message: 'Name is required' }]}>
                  <Input placeholder="Venturo Inc." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="legalName" label="Legal name">
                  <Input placeholder="Venturo Incorporated" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
                  <Input placeholder="hello@venturo.app" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="Phone">
                  <Input placeholder="+63 2 8123 4567" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label="Address">
              <Input.TextArea rows={2} placeholder="Street, city, country" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="currency" label="Currency" tooltip="Stored for reporting; formatting isn't switched yet.">
                  <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="fiscalYearStart" label="Fiscal year starts">
                  <Select options={MONTHS.map((m) => ({ value: m, label: m }))} />
                </Form.Item>
              </Col>
            </Row>

            <div className="form-actions">
              <Button type="primary" htmlType="submit" loading={isSaving}>
                Save changes
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  )
}

export default CompanyProfilePage
