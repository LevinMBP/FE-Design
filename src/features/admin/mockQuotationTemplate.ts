import { recordAuditEvent } from './mockAuditLog'

/**
 * Quotation document templates — the client-editable definition of how a
 * quotation prints. An org keeps a *library* of named templates and marks one
 * active; every quotation renders through the active one unless a draft is
 * passed in (the layout editor's live preview).
 *
 * Everything the renderer needs lives in the template: page geometry, colours,
 * typography, the letterhead shape, the ordered list of body sections, the
 * table's columns (label / order / width / alignment), totals wording and the
 * signature slots. Nothing is hard-coded in the document component.
 */

/* ---------------------------------------------------------------- options */

export type PaperSize = 'A4' | 'Letter' | 'Legal'
export type Orientation = 'portrait' | 'landscape'
export type Density = 'compact' | 'normal' | 'relaxed'
export type FontFamily = 'sans' | 'serif' | 'mono' | 'condensed'
export type LogoSize = 'small' | 'medium' | 'large'
export type LogoPosition = 'left' | 'right' | 'center'
export type HeaderStyle = 'classic' | 'centered' | 'band' | 'minimal'
export type BorderStyle = 'grid' | 'horizontal' | 'none'
export type Align = 'left' | 'center' | 'right'

/** Page geometry in CSS pixels at 96dpi (portrait). */
export const PAGE_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 }, // 210 × 297mm
  Letter: { width: 816, height: 1056 }, // 8.5 × 11in
  Legal: { width: 816, height: 1344 }, // 8.5 × 14in
}

/* ------------------------------------------------------------ table cols */

export type ColumnKey =
  | 'rowNo'
  | 'item'
  | 'packaging'
  | 'description'
  | 'qty'
  | 'uom'
  | 'unitPrice'
  | 'amount'

/** One column of the line-items table. `weight` is a share of the table width. */
export interface ColumnConfig {
  key: ColumnKey
  label: string
  visible: boolean
  weight: number
  align: Align
}

/* ------------------------------------------------------------- meta rows */

/** Where a letterhead/meta row gets its value. `static` prints `value` as-is. */
export type MetaSource =
  | 'reference'
  | 'status'
  | 'date'
  | 'effectiveDate'
  | 'expiryDate'
  | 'customer'
  | 'static'

export interface MetaRow {
  id: string
  label: string
  source: MetaSource
  /** Only used when `source` is 'static'. */
  value: string
  visible: boolean
}

/* -------------------------------------------------------------- sections */

/**
 * A body block. Built-in kinds pull their content from the quotation; `custom`
 * blocks carry their own title/body so clients can add fixed clauses (bank
 * details, delivery terms, warranty…) anywhere in the flow.
 */
export type SectionKind =
  | 'parties'
  | 'items'
  | 'totals'
  | 'notes'
  | 'terms'
  | 'signatures'
  | 'custom'

export interface SectionConfig {
  id: string
  kind: SectionKind
  /** Heading shown above the block (blank hides the heading). */
  title: string
  /** Body text — `custom` blocks only. */
  body: string
  visible: boolean
}

/* ------------------------------------------------------------ signatures */

export type SignatureSource = 'preparedBy' | 'approvedBy' | 'blank'

export interface SignatureSlotConfig {
  id: string
  /** Caption under the rule, e.g. 'Prepared by'. */
  role: string
  source: SignatureSource
  visible: boolean
}

/* -------------------------------------------------------------- template */

export interface QuotationTemplate {
  id: string
  name: string

  /* Page */
  paperSize: PaperSize
  orientation: Orientation
  margin: { top: number; right: number; bottom: number; left: number }
  pageBorder: boolean

  /* Typography */
  fontFamily: FontFamily
  baseFontSize: number // px
  density: Density // row/section spacing scale
  uppercaseLabels: boolean

  /* Colour */
  accentColor: string
  textColor: string
  mutedColor: string

  /* Letterhead */
  headerStyle: HeaderStyle
  showLogo: boolean
  logoPosition: LogoPosition
  logoSize: LogoSize
  companyFields: { name: boolean; address: boolean; email: boolean; phone: boolean }
  headerNote: string // free line under the company block (TIN, registration…)
  titleLabel: string
  subtitle: string
  showReference: boolean
  showStatusBadge: boolean
  showHeaderRule: boolean

  /* Watermark */
  watermark: {
    enabled: boolean
    text: string
    /** Print the document status instead of `text` (DRAFT, EXPIRED…). */
    useStatus: boolean
    opacity: number // 0–1
    angle: number // degrees
  }

  /* Bill-to block + meta rows */
  billToLabel: string
  partyFields: { contactPerson: boolean; email: boolean; address: boolean }
  metaRows: MetaRow[]

  /* Line items table */
  columns: ColumnConfig[]
  table: {
    borderStyle: BorderStyle
    zebra: boolean
    accentHeader: boolean
    uppercaseHeader: boolean
    /** Print the description under the item name instead of in its own column. */
    descriptionUnderItem: boolean
    /** Pad the table out to this many rows so short quotes keep their shape. */
    minRows: number
  }

  /* Body order */
  sections: SectionConfig[]

  /* Totals */
  totals: {
    subtotalLabel: string
    discountLabel: string
    grandTotalLabel: string
    showTaxLines: boolean
    showZeroTax: boolean
    amountInWords: boolean
    showCurrencyCode: boolean
    /** Fill the grand-total row with the accent colour. */
    accentGrandTotal: boolean
    width: number // px, the totals block width
  }

  /* Signatures */
  signatures: SignatureSlotConfig[]
  signatureColumns: 1 | 2 | 3
  signatureNote: string

  /* Footer */
  footerText: string
  showPageNumber: boolean
  showGeneratedBy: boolean
  footerDivider: boolean

  /* Content defaults */
  termsText: string // body of the built-in 'terms' section
  defaultTerms: string // seeds the Notes field on new quotations
}

/* ----------------------------------------------------------- the default */

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'rowNo', label: '#', visible: false, weight: 5, align: 'right' },
  { key: 'item', label: 'Item', visible: true, weight: 21, align: 'left' },
  { key: 'packaging', label: 'Packaging', visible: true, weight: 13, align: 'left' },
  { key: 'description', label: 'Description', visible: true, weight: 27, align: 'left' },
  { key: 'qty', label: 'Qty', visible: true, weight: 11, align: 'right' },
  { key: 'uom', label: 'UoM', visible: false, weight: 8, align: 'left' },
  { key: 'unitPrice', label: 'Unit price', visible: true, weight: 14, align: 'right' },
  { key: 'amount', label: 'Amount', visible: true, weight: 14, align: 'right' },
]

const DEFAULT_META_ROWS: MetaRow[] = [
  { id: 'issued', label: 'Issued', source: 'date', value: '', visible: true },
  { id: 'effective', label: 'Effective', source: 'effectiveDate', value: '', visible: true },
  { id: 'expiry', label: 'Valid until', source: 'expiryDate', value: '', visible: true },
]

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'parties', kind: 'parties', title: '', body: '', visible: true },
  { id: 'items', kind: 'items', title: '', body: '', visible: true },
  { id: 'totals', kind: 'totals', title: '', body: '', visible: true },
  { id: 'notes', kind: 'notes', title: 'Notes', body: '', visible: true },
  { id: 'terms', kind: 'terms', title: 'Terms & conditions', body: '', visible: false },
  { id: 'signatures', kind: 'signatures', title: '', body: '', visible: true },
]

const DEFAULT_SIGNATURES: SignatureSlotConfig[] = [
  { id: 'prepared', role: 'Prepared by', source: 'preparedBy', visible: true },
  { id: 'approved', role: 'Approved by', source: 'approvedBy', visible: true },
]

export const DEFAULT_QUOTATION_TEMPLATE: QuotationTemplate = {
  id: 'standard',
  name: 'Standard',

  paperSize: 'A4',
  orientation: 'portrait',
  margin: { top: 48, right: 46, bottom: 30, left: 46 },
  pageBorder: false,

  fontFamily: 'sans',
  baseFontSize: 12.5,
  density: 'normal',
  uppercaseLabels: true,

  accentColor: '#4f46e5',
  textColor: '#1f2937',
  mutedColor: '#6b7280',

  headerStyle: 'classic',
  showLogo: true,
  logoPosition: 'left',
  logoSize: 'medium',
  companyFields: { name: true, address: true, email: true, phone: true },
  headerNote: '',
  titleLabel: 'QUOTATION',
  subtitle: '',
  showReference: true,
  showStatusBadge: true,
  showHeaderRule: true,

  watermark: { enabled: false, text: 'DRAFT', useStatus: false, opacity: 0.08, angle: -30 },

  billToLabel: 'Bill to',
  partyFields: { contactPerson: true, email: true, address: true },
  metaRows: DEFAULT_META_ROWS,

  columns: DEFAULT_COLUMNS,
  table: {
    borderStyle: 'horizontal',
    zebra: false,
    accentHeader: false,
    uppercaseHeader: true,
    descriptionUnderItem: false,
    minRows: 0,
  },

  sections: DEFAULT_SECTIONS,

  totals: {
    subtotalLabel: 'Subtotal',
    discountLabel: 'Discount',
    grandTotalLabel: 'Total',
    showTaxLines: true,
    showZeroTax: true,
    amountInWords: false,
    showCurrencyCode: false,
    accentGrandTotal: false,
    width: 280,
  },

  signatures: DEFAULT_SIGNATURES,
  signatureColumns: 2,
  signatureNote: '',

  footerText: '',
  showPageNumber: false,
  showGeneratedBy: true,
  footerDivider: true,

  termsText: '',
  defaultTerms: '',
}

/* --------------------------------------------------------- style presets */

/**
 * One-click looks. Each preset is a patch over the current template — it only
 * touches presentation, never the client's wording or content blocks.
 */
export interface TemplatePreset {
  id: string
  name: string
  description: string
  patch: Partial<QuotationTemplate>
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Logo left, accent rule, roomy table.',
    patch: {
      headerStyle: 'classic',
      accentColor: '#4f46e5',
      fontFamily: 'sans',
      showHeaderRule: true,
      table: { ...DEFAULT_QUOTATION_TEMPLATE.table },
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Accent header band, filled table head.',
    patch: {
      headerStyle: 'band',
      logoPosition: 'left',
      accentColor: '#0f172a',
      fontFamily: 'sans',
      showHeaderRule: false,
      table: {
        borderStyle: 'horizontal',
        zebra: true,
        accentHeader: true,
        uppercaseHeader: true,
        descriptionUnderItem: false,
        minRows: 0,
      },
      totals: { ...DEFAULT_QUOTATION_TEMPLATE.totals, accentGrandTotal: true },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'No rules, light type, description under the item.',
    patch: {
      headerStyle: 'minimal',
      accentColor: '#111827',
      fontFamily: 'sans',
      showHeaderRule: false,
      showStatusBadge: false,
      uppercaseLabels: false,
      table: {
        borderStyle: 'none',
        zebra: false,
        accentHeader: false,
        uppercaseHeader: false,
        descriptionUnderItem: true,
        minRows: 0,
      },
    },
  },
  {
    id: 'formal',
    name: 'Formal',
    description: 'Centred serif letterhead, full grid table.',
    patch: {
      headerStyle: 'centered',
      logoPosition: 'center',
      accentColor: '#7f1d1d',
      fontFamily: 'serif',
      baseFontSize: 12,
      showHeaderRule: true,
      table: {
        borderStyle: 'grid',
        zebra: false,
        accentHeader: false,
        uppercaseHeader: true,
        descriptionUnderItem: false,
        minRows: 6,
      },
      totals: { ...DEFAULT_QUOTATION_TEMPLATE.totals, amountInWords: true },
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Tight margins and rows — fits long quotes on one page.',
    patch: {
      density: 'compact',
      baseFontSize: 11.5,
      margin: { top: 32, right: 34, bottom: 24, left: 34 },
      fontFamily: 'condensed',
      table: {
        borderStyle: 'horizontal',
        zebra: true,
        accentHeader: false,
        uppercaseHeader: true,
        descriptionUnderItem: true,
        minRows: 0,
      },
    },
  },
]

/* ------------------------------------------------------------- the store */

/** What's persisted: a library of templates plus the one in force. */
export interface TemplateStore {
  version: 2
  activeId: string
  templates: QuotationTemplate[]
}

const STORAGE_KEY = 'venturo.quotationTemplates'
const LEGACY_KEY = 'venturo.quotationTemplate'

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Merge stored arrays with the defaults by id/key so new options appear on old saves. */
function mergeById<T extends { key?: string; id?: string }>(
  stored: T[] | undefined,
  defaults: T[],
): T[] {
  if (!stored?.length) return clone(defaults)
  const keyOf = (v: T) => (v.key ?? v.id) as string
  const seen = new Set(stored.map(keyOf))
  return [...stored, ...defaults.filter((d) => !seen.has(keyOf(d)))].map((v) => clone(v))
}

/**
 * Fill in every field a stored/imported template is missing. Keeps old saves
 * (and hand-edited JSON imports) renderable as the schema grows.
 */
export function withTemplateDefaults(t: Partial<QuotationTemplate>): QuotationTemplate {
  const d = DEFAULT_QUOTATION_TEMPLATE
  return {
    ...d,
    ...t,
    id: t.id || uid('tpl'),
    name: t.name || 'Untitled layout',
    margin: { ...d.margin, ...t.margin },
    companyFields: { ...d.companyFields, ...t.companyFields },
    partyFields: { ...d.partyFields, ...t.partyFields },
    watermark: { ...d.watermark, ...t.watermark },
    table: { ...d.table, ...t.table },
    totals: { ...d.totals, ...t.totals },
    columns: mergeById(t.columns, d.columns),
    metaRows: t.metaRows?.length ? clone(t.metaRows) : clone(d.metaRows),
    sections: mergeById(t.sections, d.sections),
    signatures: t.signatures?.length ? clone(t.signatures) : clone(d.signatures),
  }
}

/** Shape of the pre-v2 flat template, kept only for the one-time migration. */
interface LegacyTemplate {
  showLogo?: boolean
  logoPosition?: 'left' | 'right'
  logoSize?: LogoSize
  titleLabel?: string
  accentColor?: string
  paperSize?: 'A4' | 'Letter'
  density?: Density
  fontFamily?: 'sans' | 'serif'
  accentHeader?: boolean
  zebra?: boolean
  showPackagingColumn?: boolean
  showDescriptionColumn?: boolean
  showSignatures?: boolean
  footerText?: string
  defaultTerms?: string
}

function fromLegacy(v1: LegacyTemplate): QuotationTemplate {
  const t = withTemplateDefaults({
    id: 'standard',
    name: 'Standard',
    showLogo: v1.showLogo,
    logoPosition: v1.logoPosition,
    logoSize: v1.logoSize,
    titleLabel: v1.titleLabel,
    accentColor: v1.accentColor,
    paperSize: v1.paperSize,
    density: v1.density,
    fontFamily: v1.fontFamily,
    footerText: v1.footerText,
    defaultTerms: v1.defaultTerms,
  })
  t.table.accentHeader = !!v1.accentHeader
  t.table.zebra = !!v1.zebra
  const setCol = (key: ColumnKey, visible: boolean) => {
    const col = t.columns.find((c) => c.key === key)
    if (col) col.visible = visible
  }
  if (v1.showPackagingColumn !== undefined) setCol('packaging', v1.showPackagingColumn)
  if (v1.showDescriptionColumn !== undefined) setCol('description', v1.showDescriptionColumn)
  if (v1.showSignatures !== undefined) {
    const sigs = t.sections.find((s) => s.kind === 'signatures')
    if (sigs) sigs.visible = v1.showSignatures
  }
  return t
}

function emptyStore(): TemplateStore {
  return {
    version: 2,
    activeId: DEFAULT_QUOTATION_TEMPLATE.id,
    templates: [clone(DEFAULT_QUOTATION_TEMPLATE)],
  }
}

function load(): TemplateStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TemplateStore>
      const templates = (parsed.templates ?? []).map(withTemplateDefaults)
      if (templates.length) {
        const activeId = templates.some((t) => t.id === parsed.activeId)
          ? parsed.activeId!
          : templates[0].id
        return { version: 2, activeId, templates }
      }
    }
    // One-time upgrade from the single flat template.
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const migrated = fromLegacy(JSON.parse(legacy) as LegacyTemplate)
      return { version: 2, activeId: migrated.id, templates: [migrated] }
    }
  } catch {
    /* fall through to a clean store */
  }
  return emptyStore()
}

let store: TemplateStore = load()

function persist(action: string, target?: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  recordAuditEvent({ module: 'admin', action, target })
}

const find = (id: string) => store.templates.find((t) => t.id === id)

/* ---------------------------------------------------------------- reads */

export function listQuotationTemplates(): QuotationTemplate[] {
  return clone(store.templates)
}

export function getTemplateStore(): TemplateStore {
  return clone(store)
}

/** The template every quotation renders through. */
export function getQuotationTemplate(): QuotationTemplate {
  return clone(find(store.activeId) ?? store.templates[0] ?? DEFAULT_QUOTATION_TEMPLATE)
}

/* --------------------------------------------------------------- writes */

/** Patch the active template (kept for callers that only know "the" layout). */
export function updateQuotationTemplate(patch: Partial<QuotationTemplate>): QuotationTemplate {
  const current = getQuotationTemplate()
  return saveQuotationTemplate({ ...current, ...patch, id: current.id })
}

/** Replace one template in the library wholesale. */
export function saveQuotationTemplate(template: QuotationTemplate): QuotationTemplate {
  const next = withTemplateDefaults(template)
  const i = store.templates.findIndex((t) => t.id === next.id)
  if (i === -1) store.templates.push(next)
  else store.templates[i] = next
  persist('Updated quotation layout', next.name)
  return clone(next)
}

/** Add a template — blank (from the shipped default) or copied from `sourceId`. */
export function createQuotationTemplate(name: string, sourceId?: string): QuotationTemplate {
  const source = sourceId ? find(sourceId) : undefined
  const created = withTemplateDefaults({
    ...clone(source ?? DEFAULT_QUOTATION_TEMPLATE),
    id: uid('tpl'),
    name: name.trim() || 'Untitled layout',
  })
  store.templates.push(created)
  persist('Created quotation layout', created.name)
  return clone(created)
}

/** Remove a template. The last one can't be deleted — there'd be nothing to print. */
export function deleteQuotationTemplate(id: string): TemplateStore {
  if (store.templates.length <= 1) throw new Error('Keep at least one layout.')
  const removed = find(id)
  store.templates = store.templates.filter((t) => t.id !== id)
  if (store.activeId === id) store.activeId = store.templates[0].id
  persist('Deleted quotation layout', removed?.name)
  return getTemplateStore()
}

/** Mark which template quotations print with. */
export function setActiveQuotationTemplate(id: string): TemplateStore {
  if (!find(id)) throw new Error('That layout no longer exists.')
  store.activeId = id
  persist('Set active quotation layout', find(id)?.name)
  return getTemplateStore()
}

/** Import a template from exported JSON; always lands as a new library entry. */
export function importQuotationTemplate(json: string): QuotationTemplate {
  const parsed = JSON.parse(json) as Partial<QuotationTemplate>
  const imported = withTemplateDefaults({
    ...parsed,
    id: uid('tpl'),
    name: `${parsed.name || 'Imported layout'} (imported)`,
  })
  store.templates.push(imported)
  persist('Imported quotation layout', imported.name)
  return clone(imported)
}

/* ------------------------------------------------------ editor utilities */

/** Reset to the shipped layout, keeping the template's identity and name. */
export function resetTemplate(t: QuotationTemplate): QuotationTemplate {
  return { ...clone(DEFAULT_QUOTATION_TEMPLATE), id: t.id, name: t.name }
}

/** Apply a style preset without touching identity or the client's wording. */
export function applyPreset(t: QuotationTemplate, preset: TemplatePreset): QuotationTemplate {
  return withTemplateDefaults({ ...t, ...clone(preset.patch), id: t.id, name: t.name })
}

export function newCustomSection(): SectionConfig {
  return { id: uid('sec'), kind: 'custom', title: 'New section', body: '', visible: true }
}

export function newMetaRow(): MetaRow {
  return { id: uid('meta'), label: 'Label', source: 'static', value: '', visible: true }
}

export function newSignatureSlot(): SignatureSlotConfig {
  return { id: uid('sig'), role: 'Received by', source: 'blank', visible: true }
}
