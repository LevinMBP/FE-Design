import type { ReactNode } from 'react'
import {
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Segmented,
  Select,
  Slider,
  Switch,
  Tabs,
  Tooltip,
} from 'antd'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import {
  newCustomSection,
  newMetaRow,
  newSignatureSlot,
  type Align,
  type BorderStyle,
  type ColumnConfig,
  type Density,
  type FontFamily,
  type HeaderStyle,
  type LogoPosition,
  type LogoSize,
  type MetaRow,
  type MetaSource,
  type Orientation,
  type PaperSize,
  type QuotationTemplate,
  type SectionConfig,
  type SignatureSlotConfig,
  type SignatureSource,
} from './mockQuotationTemplate'

const { TextArea } = Input

/** Move an item within a list; out-of-range targets leave the list untouched. */
function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** One labelled control row. */
function Field({
  label,
  hint,
  children,
  stacked,
}: {
  label: string
  hint?: string
  children?: ReactNode
  /** Put the control on its own line below the label (for wide inputs). */
  stacked?: boolean
}) {
  return (
    <div className={`qtpl-field${stacked ? ' qtpl-field--stacked' : ''}`}>
      <div className="qtpl-field__text">
        <div className="qtpl-field__label">{label}</div>
        {hint && <div className="qtpl-field__hint">{hint}</div>}
      </div>
      {children && <div className="qtpl-field__control">{children}</div>}
    </div>
  )
}

function GroupTitle({ children }: { children: ReactNode }) {
  return <div className="qtpl-group">{children}</div>
}

/** A reorderable row in one of the list editors (columns, sections, rows…). */
function ListRow({
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  index: number
  count: number
  onMove: (to: number) => void
  onRemove?: () => void
  children: ReactNode
}) {
  return (
    <div className="qtpl-row">
      <div className="qtpl-row__move">
        <Button
          type="text"
          size="small"
          disabled={index === 0}
          icon={<ChevronUp size={14} />}
          onClick={() => onMove(index - 1)}
          aria-label="Move up"
        />
        <Button
          type="text"
          size="small"
          disabled={index === count - 1}
          icon={<ChevronDown size={14} />}
          onClick={() => onMove(index + 1)}
          aria-label="Move down"
        />
      </div>
      <div className="qtpl-row__body">{children}</div>
      <div className="qtpl-row__end">
        {onRemove && (
          <Tooltip title="Remove">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={onRemove}
              aria-label="Remove"
            />
          </Tooltip>
        )}
      </div>
    </div>
  )
}

const ALIGN_OPTIONS = [
  { value: 'left' as Align, label: 'L' },
  { value: 'center' as Align, label: 'C' },
  { value: 'right' as Align, label: 'R' },
]

const META_SOURCES: { value: MetaSource; label: string }[] = [
  { value: 'date', label: 'Quotation date' },
  { value: 'effectiveDate', label: 'Effective date' },
  { value: 'expiryDate', label: 'Expiry date' },
  { value: 'reference', label: 'Reference no.' },
  { value: 'status', label: 'Status' },
  { value: 'customer', label: 'Customer name' },
  { value: 'static', label: 'Fixed text' },
]

const SIGNATURE_SOURCES: { value: SignatureSource; label: string }[] = [
  { value: 'preparedBy', label: 'Prepared-by signature' },
  { value: 'approvedBy', label: 'Approved-by signature' },
  { value: 'blank', label: 'Blank line' },
]

/** Human labels for the built-in body blocks. */
const SECTION_LABELS: Record<SectionConfig['kind'], string> = {
  parties: 'Bill to + dates',
  items: 'Line items table',
  totals: 'Totals',
  notes: 'Notes (from the quotation)',
  terms: 'Terms & conditions',
  signatures: 'Signatures',
  custom: 'Custom block',
}

interface Props {
  draft: QuotationTemplate
  set: (patch: Partial<QuotationTemplate>) => void
}

/**
 * The full control surface of the quotation layout editor, grouped into tabs.
 * Every control writes straight into the draft template the page previews, so
 * nothing is applied until the page's Save is pressed.
 */
function QuotationLayoutControls({ draft, set }: Props) {
  const setMargin = (patch: Partial<QuotationTemplate['margin']>) =>
    set({ margin: { ...draft.margin, ...patch } })
  const setTable = (patch: Partial<QuotationTemplate['table']>) =>
    set({ table: { ...draft.table, ...patch } })
  const setTotals = (patch: Partial<QuotationTemplate['totals']>) =>
    set({ totals: { ...draft.totals, ...patch } })
  const setWatermark = (patch: Partial<QuotationTemplate['watermark']>) =>
    set({ watermark: { ...draft.watermark, ...patch } })

  /* ---- Page ---- */
  const pageTab = (
    <>
      <Field label="Paper size">
        <Segmented<PaperSize>
          value={draft.paperSize}
          onChange={(v) => set({ paperSize: v })}
          options={[
            { value: 'A4', label: 'A4' },
            { value: 'Letter', label: 'Letter' },
            { value: 'Legal', label: 'Legal' },
          ]}
        />
      </Field>
      <Field label="Orientation">
        <Segmented<Orientation>
          value={draft.orientation}
          onChange={(v) => set({ orientation: v })}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
        />
      </Field>
      <Field label="Margins" hint="Printable area inset, in points." stacked>
        <div className="qtpl-grid4">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <label className="qtpl-mini" key={side}>
              <span>{side}</span>
              <InputNumber
                size="small"
                min={0}
                max={140}
                value={draft.margin[side]}
                onChange={(v) => setMargin({ [side]: v ?? 0 })}
              />
            </label>
          ))}
        </div>
      </Field>
      <Field label="Page border" hint="Prints a thin accent frame inside the margins.">
        <Switch checked={draft.pageBorder} onChange={(v) => set({ pageBorder: v })} />
      </Field>

      <GroupTitle>Typography</GroupTitle>
      <Field label="Font">
        <Segmented<FontFamily>
          value={draft.fontFamily}
          onChange={(v) => set({ fontFamily: v })}
          options={[
            { value: 'sans', label: 'Sans' },
            { value: 'serif', label: 'Serif' },
            { value: 'condensed', label: 'Narrow' },
            { value: 'mono', label: 'Mono' },
          ]}
        />
      </Field>
      <Field label="Base text size">
        <InputNumber
          min={8}
          max={18}
          step={0.5}
          value={draft.baseFontSize}
          onChange={(v) => set({ baseFontSize: v ?? 12.5 })}
          addonAfter="px"
          style={{ width: 132 }}
        />
      </Field>
      <Field label="Density" hint="Spacing between blocks and table rows.">
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
      <Field label="Uppercase labels" hint="Small-caps headings above each block.">
        <Switch checked={draft.uppercaseLabels} onChange={(v) => set({ uppercaseLabels: v })} />
      </Field>

      <GroupTitle>Colour</GroupTitle>
      <Field label="Accent" hint="Title, rules, brand mark and filled areas.">
        <ColorPicker
          value={draft.accentColor}
          onChange={(_, hex) => set({ accentColor: hex })}
          presets={[
            {
              label: 'Suggested',
              colors: ['#4f46e5', '#0ea5e9', '#059669', '#e11d48', '#f59e0b', '#0f172a', '#7f1d1d'],
            },
          ]}
        />
      </Field>
      <Field label="Body text">
        <ColorPicker
          value={draft.textColor}
          onChange={(_, hex) => set({ textColor: hex })}
          presets={[{ label: 'Ink', colors: ['#1f2937', '#111827', '#000000', '#374151'] }]}
        />
      </Field>
      <Field label="Secondary text" hint="Labels, meta lines and captions.">
        <ColorPicker
          value={draft.mutedColor}
          onChange={(_, hex) => set({ mutedColor: hex })}
          presets={[{ label: 'Muted', colors: ['#6b7280', '#9ca3af', '#4b5563', '#78716c'] }]}
        />
      </Field>
    </>
  )

  /* ---- Letterhead ---- */
  const headerTab = (
    <>
      <Field label="Letterhead style">
        <Segmented<HeaderStyle>
          value={draft.headerStyle}
          onChange={(v) => set({ headerStyle: v })}
          options={[
            { value: 'classic', label: 'Classic' },
            { value: 'centered', label: 'Centred' },
            { value: 'band', label: 'Band' },
            { value: 'minimal', label: 'Minimal' },
          ]}
        />
      </Field>
      <Field label="Show company logo" hint="Uses the logo uploaded on the Company page.">
        <Switch checked={draft.showLogo} onChange={(v) => set({ showLogo: v })} />
      </Field>
      <Field label="Logo position">
        <Segmented<LogoPosition>
          disabled={!draft.showLogo || draft.headerStyle === 'centered'}
          value={draft.logoPosition}
          onChange={(v) => set({ logoPosition: v })}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Centre' },
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

      <GroupTitle>Company details</GroupTitle>
      {(
        [
          ['name', 'Company name'],
          ['address', 'Address'],
          ['email', 'Email'],
          ['phone', 'Phone'],
        ] as const
      ).map(([key, label]) => (
        <Field label={label} key={key}>
          <Switch
            checked={draft.companyFields[key]}
            onChange={(v) => set({ companyFields: { ...draft.companyFields, [key]: v } })}
          />
        </Field>
      ))}
      <Field label="Extra line" hint="Printed under the company block — TIN, registration no., tagline." stacked>
        <Input
          value={draft.headerNote}
          onChange={(e) => set({ headerNote: e.target.value })}
          placeholder="e.g. VAT Reg. TIN 000-123-456-000"
        />
      </Field>

      <GroupTitle>Document title</GroupTitle>
      <Field label="Title" stacked>
        <Input
          value={draft.titleLabel}
          onChange={(e) => set({ titleLabel: e.target.value })}
          placeholder="QUOTATION"
        />
      </Field>
      <Field label="Subtitle" hint="Optional line under the title." stacked>
        <Input
          value={draft.subtitle}
          onChange={(e) => set({ subtitle: e.target.value })}
          placeholder="e.g. Sales proposal"
        />
      </Field>
      <Field label="Reference number">
        <Switch checked={draft.showReference} onChange={(v) => set({ showReference: v })} />
      </Field>
      <Field label="Status badge">
        <Switch checked={draft.showStatusBadge} onChange={(v) => set({ showStatusBadge: v })} />
      </Field>
      <Field label="Rule under the letterhead">
        <Switch checked={draft.showHeaderRule} onChange={(v) => set({ showHeaderRule: v })} />
      </Field>

      <GroupTitle>Watermark</GroupTitle>
      <Field label="Print a watermark">
        <Switch
          checked={draft.watermark.enabled}
          onChange={(v) => setWatermark({ enabled: v })}
        />
      </Field>
      <Field label="Use the document status" hint="Stamps DRAFT, SENT, EXPIRED… automatically.">
        <Switch
          disabled={!draft.watermark.enabled}
          checked={draft.watermark.useStatus}
          onChange={(v) => setWatermark({ useStatus: v })}
        />
      </Field>
      <Field label="Watermark text" stacked>
        <Input
          disabled={!draft.watermark.enabled || draft.watermark.useStatus}
          value={draft.watermark.text}
          onChange={(e) => setWatermark({ text: e.target.value })}
          placeholder="DRAFT"
        />
      </Field>
      <Field label="Strength" stacked>
        <Slider
          disabled={!draft.watermark.enabled}
          min={0.02}
          max={0.3}
          step={0.01}
          value={draft.watermark.opacity}
          onChange={(v) => setWatermark({ opacity: v })}
        />
      </Field>
      <Field label="Angle" stacked>
        <Slider
          disabled={!draft.watermark.enabled}
          min={-90}
          max={90}
          step={5}
          value={draft.watermark.angle}
          onChange={(v) => setWatermark({ angle: v })}
        />
      </Field>
    </>
  )

  /* ---- Recipient block + meta rows ---- */
  const setMetaRows = (metaRows: MetaRow[]) => set({ metaRows })
  const patchMetaRow = (id: string, patch: Partial<MetaRow>) =>
    setMetaRows(draft.metaRows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const recipientTab = (
    <>
      <Field label="Recipient heading" stacked>
        <Input
          value={draft.billToLabel}
          onChange={(e) => set({ billToLabel: e.target.value })}
          placeholder="Bill to"
        />
      </Field>
      {(
        [
          ['contactPerson', 'Contact person'],
          ['email', 'Email'],
          ['address', 'Address'],
        ] as const
      ).map(([key, label]) => (
        <Field label={label} key={key}>
          <Switch
            checked={draft.partyFields[key]}
            onChange={(v) => set({ partyFields: { ...draft.partyFields, [key]: v } })}
          />
        </Field>
      ))}

      <GroupTitle>Document detail rows</GroupTitle>
      <p className="qtpl-note">
        The label/value rows printed opposite the recipient. Add fixed rows for anything the
        quotation doesn't carry itself — payment terms, delivery lead time, a project code.
      </p>
      <div className="qtpl-list">
        {draft.metaRows.map((row, i) => (
          <ListRow
            key={row.id}
            index={i}
            count={draft.metaRows.length}
            onMove={(to) => setMetaRows(move(draft.metaRows, i, to))}
            onRemove={() => setMetaRows(draft.metaRows.filter((r) => r.id !== row.id))}
          >
            <div className="qtpl-row__grid">
              <Input
                size="small"
                value={row.label}
                onChange={(e) => patchMetaRow(row.id, { label: e.target.value })}
                placeholder="Label"
              />
              <Select<MetaSource>
                size="small"
                value={row.source}
                onChange={(v) => patchMetaRow(row.id, { source: v })}
                options={META_SOURCES}
                style={{ width: 150 }}
              />
              <Switch
                size="small"
                checked={row.visible}
                onChange={(v) => patchMetaRow(row.id, { visible: v })}
              />
            </div>
            {row.source === 'static' && (
              <Input
                size="small"
                value={row.value}
                onChange={(e) => patchMetaRow(row.id, { value: e.target.value })}
                placeholder="Printed value, e.g. 50% down payment"
              />
            )}
          </ListRow>
        ))}
      </div>
      <Button
        size="small"
        icon={<Plus size={14} />}
        onClick={() => setMetaRows([...draft.metaRows, newMetaRow()])}
      >
        Add row
      </Button>
    </>
  )

  /* ---- Table ---- */
  const setColumns = (columns: ColumnConfig[]) => set({ columns })
  const patchColumn = (key: string, patch: Partial<ColumnConfig>) =>
    setColumns(draft.columns.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const tableTab = (
    <>
      <Field label="Borders">
        <Segmented<BorderStyle>
          value={draft.table.borderStyle}
          onChange={(v) => setTable({ borderStyle: v })}
          options={[
            { value: 'horizontal', label: 'Rows' },
            { value: 'grid', label: 'Grid' },
            { value: 'none', label: 'None' },
          ]}
        />
      </Field>
      <Field label="Accent header" hint="Fill the header row with the accent colour.">
        <Switch checked={draft.table.accentHeader} onChange={(v) => setTable({ accentHeader: v })} />
      </Field>
      <Field label="Zebra rows" hint="Shade alternate rows.">
        <Switch checked={draft.table.zebra} onChange={(v) => setTable({ zebra: v })} />
      </Field>
      <Field label="Uppercase header labels">
        <Switch
          checked={draft.table.uppercaseHeader}
          onChange={(v) => setTable({ uppercaseHeader: v })}
        />
      </Field>
      <Field
        label="Description under item"
        hint="Prints the description as a second line instead of its own column."
      >
        <Switch
          checked={draft.table.descriptionUnderItem}
          onChange={(v) => setTable({ descriptionUnderItem: v })}
        />
      </Field>
      <Field label="Minimum rows" hint="Pad short quotes with blank ruled rows.">
        <InputNumber
          min={0}
          max={30}
          value={draft.table.minRows}
          onChange={(v) => setTable({ minRows: v ?? 0 })}
          style={{ width: 90 }}
        />
      </Field>

      <GroupTitle>Columns</GroupTitle>
      <p className="qtpl-note">
        Reorder, rename, resize and hide columns. Widths are shares — the visible columns are
        scaled to fill the page, so a column of weight 20 takes twice the space of one at 10.
      </p>
      <div className="qtpl-list">
        {draft.columns.map((col, i) => (
          <ListRow
            key={col.key}
            index={i}
            count={draft.columns.length}
            onMove={(to) => setColumns(move(draft.columns, i, to))}
          >
            <div className="qtpl-row__grid">
              <Input
                size="small"
                value={col.label}
                onChange={(e) => patchColumn(col.key, { label: e.target.value })}
                placeholder="Heading"
              />
              <Tooltip title="Width share">
                <InputNumber
                  size="small"
                  min={1}
                  max={60}
                  value={col.weight}
                  onChange={(v) => patchColumn(col.key, { weight: v ?? 10 })}
                  style={{ width: 62 }}
                />
              </Tooltip>
              <Segmented<Align>
                size="small"
                value={col.align}
                onChange={(v) => patchColumn(col.key, { align: v })}
                options={ALIGN_OPTIONS}
              />
              <Switch
                size="small"
                checked={col.visible}
                onChange={(v) => patchColumn(col.key, { visible: v })}
              />
            </div>
          </ListRow>
        ))}
      </div>
    </>
  )

  /* ---- Body sections ---- */
  const setSections = (sections: SectionConfig[]) => set({ sections })
  const patchSection = (id: string, patch: Partial<SectionConfig>) =>
    setSections(draft.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const sectionsTab = (
    <>
      <p className="qtpl-note">
        The order blocks print in. Hide what you don't need, and add custom blocks for fixed
        clauses — bank details, delivery terms, a warranty statement.
      </p>
      <div className="qtpl-list">
        {draft.sections.map((section, i) => (
          <ListRow
            key={section.id}
            index={i}
            count={draft.sections.length}
            onMove={(to) => setSections(move(draft.sections, i, to))}
            onRemove={
              section.kind === 'custom'
                ? () => setSections(draft.sections.filter((s) => s.id !== section.id))
                : undefined
            }
          >
            <div className="qtpl-row__grid">
              <div className="qtpl-row__title">{SECTION_LABELS[section.kind]}</div>
              <Switch
                size="small"
                checked={section.visible}
                onChange={(v) => patchSection(section.id, { visible: v })}
              />
            </div>
            {(section.kind === 'notes' ||
              section.kind === 'terms' ||
              section.kind === 'custom') && (
              <Input
                size="small"
                value={section.title}
                onChange={(e) => patchSection(section.id, { title: e.target.value })}
                placeholder="Heading (leave blank for none)"
              />
            )}
            {section.kind === 'custom' && (
              <TextArea
                rows={3}
                value={section.body}
                onChange={(e) => patchSection(section.id, { body: e.target.value })}
                placeholder="Text printed in this block"
              />
            )}
            {section.kind === 'terms' && (
              <TextArea
                rows={3}
                value={draft.termsText}
                onChange={(e) => set({ termsText: e.target.value })}
                placeholder="Standard terms printed on every quotation"
              />
            )}
          </ListRow>
        ))}
      </div>
      <Button
        size="small"
        icon={<Plus size={14} />}
        onClick={() => setSections([...draft.sections, newCustomSection()])}
      >
        Add custom block
      </Button>
    </>
  )

  /* ---- Totals ---- */
  const totalsTab = (
    <>
      <Field label="Subtotal label" stacked>
        <Input
          value={draft.totals.subtotalLabel}
          onChange={(e) => setTotals({ subtotalLabel: e.target.value })}
        />
      </Field>
      <Field label="Discount label" stacked>
        <Input
          value={draft.totals.discountLabel}
          onChange={(e) => setTotals({ discountLabel: e.target.value })}
        />
      </Field>
      <Field label="Grand total label" stacked>
        <Input
          value={draft.totals.grandTotalLabel}
          onChange={(e) => setTotals({ grandTotalLabel: e.target.value })}
        />
      </Field>
      <Field label="Tax lines" hint="Print a line per tax (VAT 12%, etc.).">
        <Switch
          checked={draft.totals.showTaxLines}
          onChange={(v) => setTotals({ showTaxLines: v })}
        />
      </Field>
      <Field label="Show tax when zero">
        <Switch
          disabled={!draft.totals.showTaxLines}
          checked={draft.totals.showZeroTax}
          onChange={(v) => setTotals({ showZeroTax: v })}
        />
      </Field>
      <Field label="Amount in words" hint="Spells the total out beside the totals block.">
        <Switch
          checked={draft.totals.amountInWords}
          onChange={(v) => setTotals({ amountInWords: v })}
        />
      </Field>
      <Field label="Show currency code" hint="Prefixes the grand total with e.g. PHP.">
        <Switch
          checked={draft.totals.showCurrencyCode}
          onChange={(v) => setTotals({ showCurrencyCode: v })}
        />
      </Field>
      <Field label="Highlight grand total" hint="Fills the total row with the accent colour.">
        <Switch
          checked={draft.totals.accentGrandTotal}
          onChange={(v) => setTotals({ accentGrandTotal: v })}
        />
      </Field>
      <Field label="Totals block width" stacked>
        <Slider
          min={180}
          max={420}
          step={10}
          value={draft.totals.width}
          onChange={(v) => setTotals({ width: v })}
        />
      </Field>
    </>
  )

  /* ---- Signatures ---- */
  const setSignatures = (signatures: SignatureSlotConfig[]) => set({ signatures })
  const patchSignature = (id: string, patch: Partial<SignatureSlotConfig>) =>
    setSignatures(draft.signatures.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const signaturesTab = (
    <>
      <Field label="Slots per row">
        <Segmented<1 | 2 | 3>
          value={draft.signatureColumns}
          onChange={(v) => set({ signatureColumns: v })}
          options={[
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
        />
      </Field>
      <p className="qtpl-note">
        Each slot prints a signature line and its caption. Slots bound to prepared-by or
        approved-by pick up the drawn signature captured on the quotation; blank ones are for the
        customer to sign.
      </p>
      <div className="qtpl-list">
        {draft.signatures.map((slot, i) => (
          <ListRow
            key={slot.id}
            index={i}
            count={draft.signatures.length}
            onMove={(to) => setSignatures(move(draft.signatures, i, to))}
            onRemove={() => setSignatures(draft.signatures.filter((s) => s.id !== slot.id))}
          >
            <div className="qtpl-row__grid">
              <Input
                size="small"
                value={slot.role}
                onChange={(e) => patchSignature(slot.id, { role: e.target.value })}
                placeholder="Caption"
              />
              <Select<SignatureSource>
                size="small"
                value={slot.source}
                onChange={(v) => patchSignature(slot.id, { source: v })}
                options={SIGNATURE_SOURCES}
                style={{ width: 180 }}
              />
              <Switch
                size="small"
                checked={slot.visible}
                onChange={(v) => patchSignature(slot.id, { visible: v })}
              />
            </div>
          </ListRow>
        ))}
      </div>
      <Button
        size="small"
        icon={<Plus size={14} />}
        onClick={() => setSignatures([...draft.signatures, newSignatureSlot()])}
      >
        Add signature slot
      </Button>

      <GroupTitle>Note under the signatures</GroupTitle>
      <TextArea
        rows={2}
        value={draft.signatureNote}
        onChange={(e) => set({ signatureNote: e.target.value })}
        placeholder="e.g. Sign and return one copy to confirm this quotation."
      />
    </>
  )

  /* ---- Footer + defaults ---- */
  const footerTab = (
    <>
      <Field label="Footer text" hint="Bottom of every page — bank details, a thank-you." stacked>
        <TextArea
          rows={2}
          value={draft.footerText}
          onChange={(e) => set({ footerText: e.target.value })}
          placeholder="e.g. Thank you for your business · BDO 1234-5678"
        />
      </Field>
      <Field label="Divider line above the footer">
        <Switch checked={draft.footerDivider} onChange={(v) => set({ footerDivider: v })} />
      </Field>
      <Field label="Page numbers">
        <Switch checked={draft.showPageNumber} onChange={(v) => set({ showPageNumber: v })} />
      </Field>
      <Field label="Reference + 'Generated by Venturo'">
        <Switch checked={draft.showGeneratedBy} onChange={(v) => set({ showGeneratedBy: v })} />
      </Field>

      <GroupTitle>New quotation defaults</GroupTitle>
      <Field
        label="Default notes"
        hint="Prefills the Notes field on new quotations (still editable per quote)."
        stacked
      >
        <TextArea
          rows={3}
          value={draft.defaultTerms}
          onChange={(e) => set({ defaultTerms: e.target.value })}
          placeholder="e.g. Prices valid for 30 days. 50% down payment to begin."
        />
      </Field>
    </>
  )

  return (
    <Tabs
      size="small"
      className="qtpl-tabs"
      items={[
        { key: 'page', label: 'Page', children: pageTab },
        { key: 'header', label: 'Letterhead', children: headerTab },
        { key: 'recipient', label: 'Recipient', children: recipientTab },
        { key: 'table', label: 'Table', children: tableTab },
        { key: 'sections', label: 'Sections', children: sectionsTab },
        { key: 'totals', label: 'Totals', children: totalsTab },
        { key: 'signatures', label: 'Signatures', children: signaturesTab },
        { key: 'footer', label: 'Footer', children: footerTab },
      ]}
    />
  )
}

export default QuotationLayoutControls
