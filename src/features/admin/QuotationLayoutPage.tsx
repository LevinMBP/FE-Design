import { useEffect, useState } from 'react'
import { App, Button, Card, ColorPicker, Input, Segmented, Switch } from 'antd'
import dayjs from 'dayjs'
import {
  useGetQuotationTemplateQuery,
  useUpdateQuotationTemplateMutation,
} from './adminApi'
import {
  DEFAULT_QUOTATION_TEMPLATE,
  type Density,
  type FontFamily,
  type LogoSize,
  type PaperSize,
  type QuotationTemplate,
} from './mockQuotationTemplate'
import QuotationDocument, {
  type QuotationDoc,
} from '../sales/quotations/QuotationDocument'
import './admin.css'

const { TextArea } = Input

/** Sample quote used only to render the live preview in the editor. */
const SAMPLE_QUOTE: QuotationDoc = {
  reference: 'QUO-0142',
  status: 'sent',
  customerName: 'Acme Trading Corp.',
  contactPerson: 'Jorge Santos',
  email: 'purchasing@acme.example',
  address: '88 Industria St, Pasig City',
  date: dayjs().format('YYYY-MM-DD'),
  effectiveDate: dayjs().format('YYYY-MM-DD'),
  expiryDate: dayjs().add(3, 'month').format('YYYY-MM-DD'),
  lines: [
    {
      itemKind: 'material',
      itemId: 's1',
      itemName: 'Steel Bolts (M8)',
      packaging: 'Box of 100',
      description: 'Zinc-plated, DIN 933 hex head',
      quantity: 20,
      unit: 'box',
      unitPrice: 45,
    },
    {
      itemKind: 'material',
      itemId: 's2',
      itemName: 'Aluminum Sheet 2mm',
      packaging: 'Sheet',
      description:
        'Mill-finish 1220×2440mm aluminium sheet, alloy 5052-H32, protective film both sides, cut to size on request — a deliberately long line to show how descriptions wrap within the page.',
      quantity: 5,
      unit: 'sheet',
      unitPrice: 1200,
    },
    {
      itemKind: 'product',
      itemId: 's3',
      itemName: 'On-site Assembly',
      packaging: '',
      description: 'Assembly and calibration at the customer site',
      quantity: 1,
      unit: 'job',
      unitPrice: 3000,
    },
  ],
  subtotal: 9900,
  discountAmount: 0,
  taxBreakdown: [{ label: 'VAT 12%', amount: 1188 }],
  total: 11088,
  notes: 'Prices valid for 30 days. 50% down payment required to begin.',
  preparedBy: { name: 'Ava Reyes', signature: '' },
  approvedBy: { name: 'Marcus Lee', signature: '' },
}

/** One labelled control row in the editor. */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="qtpl-field">
      <div className="qtpl-field__text">
        <div className="qtpl-field__label">{label}</div>
        {hint && <div className="qtpl-field__hint">{hint}</div>}
      </div>
      <div className="qtpl-field__control">{children}</div>
    </div>
  )
}

function QuotationLayoutPage() {
  const { data: saved, isLoading } = useGetQuotationTemplateQuery()
  const [updateTemplate, { isLoading: isSaving }] = useUpdateQuotationTemplateMutation()
  const { message } = App.useApp()
  const [draft, setDraft] = useState<QuotationTemplate>(saved ?? DEFAULT_QUOTATION_TEMPLATE)

  useEffect(() => {
    if (saved) setDraft(saved)
  }, [saved])

  const set = (patch: Partial<QuotationTemplate>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const onSave = async () => {
    try {
      await updateTemplate(draft).unwrap()
      message.success('Quotation layout saved.')
    } catch {
      message.error('Could not save the layout.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Quotation layout</h1>
          <p>Customize how your quotation document looks. Changes preview live and apply to every quotation.</p>
        </div>
        <Button type="primary" onClick={onSave} loading={isSaving} disabled={!dirty || isLoading}>
          Save changes
        </Button>
      </div>

      <div className="qtpl-editor">
        <Card title="Layout options" loading={isLoading} className="qtpl-editor__controls">
          <Field label="Show company logo" hint="Uses the logo uploaded on the Company page.">
            <Switch checked={draft.showLogo} onChange={(v) => set({ showLogo: v })} />
          </Field>
          <Field label="Logo position">
            <Segmented<'left' | 'right'>
              disabled={!draft.showLogo}
              value={draft.logoPosition}
              onChange={(v) => set({ logoPosition: v })}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </Field>
          <Field label="Logo size">
            <Segmented<LogoSize>
              disabled={!draft.showLogo}
              value={draft.logoSize}
              onChange={(v) => set({ logoSize: v })}
              options={[
                { value: 'small', label: 'S' },
                { value: 'medium', label: 'M' },
                { value: 'large', label: 'L' },
              ]}
            />
          </Field>
          <Field label="Title label" hint="The big heading word on the document.">
            <Input
              style={{ maxWidth: 240 }}
              value={draft.titleLabel}
              onChange={(e) => set({ titleLabel: e.target.value })}
              placeholder="QUOTATION"
            />
          </Field>
          <Field label="Accent color" hint="Used for the title, rules and brand mark.">
            <ColorPicker
              value={draft.accentColor}
              onChange={(_, hex) => set({ accentColor: hex })}
              presets={[
                {
                  label: 'Suggested',
                  colors: ['#4f46e5', '#0ea5e9', '#059669', '#e11d48', '#f59e0b', '#111827'],
                },
              ]}
            />
          </Field>

          <div className="qtpl-divider" />

          <Field label="Paper size">
            <Segmented<PaperSize>
              value={draft.paperSize}
              onChange={(v) => set({ paperSize: v })}
              options={[
                { value: 'A4', label: 'A4' },
                { value: 'Letter', label: 'Letter' },
              ]}
            />
          </Field>
          <Field label="Density">
            <Segmented<Density>
              value={draft.density}
              onChange={(v) => set({ density: v })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'normal', label: 'Normal' },
                { value: 'relaxed', label: 'Relaxed' },
              ]}
            />
          </Field>
          <Field label="Font">
            <Segmented<FontFamily>
              value={draft.fontFamily}
              onChange={(v) => set({ fontFamily: v })}
              options={[
                { value: 'sans', label: 'Sans' },
                { value: 'serif', label: 'Serif' },
              ]}
            />
          </Field>

          <div className="qtpl-divider" />

          <Field label="Packaging column">
            <Switch
              checked={draft.showPackagingColumn}
              onChange={(v) => set({ showPackagingColumn: v })}
            />
          </Field>
          <Field label="Description column">
            <Switch
              checked={draft.showDescriptionColumn}
              onChange={(v) => set({ showDescriptionColumn: v })}
            />
          </Field>
          <Field label="Accent table header" hint="Fill the header row with the accent color.">
            <Switch checked={draft.accentHeader} onChange={(v) => set({ accentHeader: v })} />
          </Field>
          <Field label="Zebra rows" hint="Shade alternate rows.">
            <Switch checked={draft.zebra} onChange={(v) => set({ zebra: v })} />
          </Field>
          <Field label="Signature blocks">
            <Switch checked={draft.showSignatures} onChange={(v) => set({ showSignatures: v })} />
          </Field>

          <div className="qtpl-divider" />

          <Field label="Footer text" hint="Shown at the bottom of every page (e.g. bank details, thank-you).">
            <span />
          </Field>
          <TextArea
            rows={2}
            value={draft.footerText}
            onChange={(e) => set({ footerText: e.target.value })}
            placeholder="e.g. Thank you for your business · BDO 1234-5678"
          />

          <Field label="Default terms / notes" hint="Prefills the Notes on new quotations (still editable per quote).">
            <span />
          </Field>
          <TextArea
            rows={3}
            value={draft.defaultTerms}
            onChange={(e) => set({ defaultTerms: e.target.value })}
            placeholder="e.g. Prices valid for 30 days. 50% down payment to begin."
          />
        </Card>

        <div className="qtpl-editor__preview">
          <div className="qtpl-editor__preview-head">Live preview</div>
          <QuotationDocument doc={SAMPLE_QUOTE} template={draft} />
        </div>
      </div>
    </div>
  )
}

export default QuotationLayoutPage
