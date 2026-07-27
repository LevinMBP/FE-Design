import { recordAuditEvent } from './mockAuditLog'

export type PaperSize = 'A4' | 'Letter'
export type Density = 'compact' | 'normal' | 'relaxed'
export type FontFamily = 'sans' | 'serif'
export type LogoSize = 'small' | 'medium' | 'large'

/** Client-customizable layout options for the quotation document. Org-wide. */
export interface QuotationTemplate {
  // Branding
  showLogo: boolean
  logoPosition: 'left' | 'right'
  logoSize: LogoSize
  titleLabel: string // the big heading word, e.g. 'QUOTATION'
  accentColor: string // hex; used for title, rules, brand mark, header fill
  // Page & typography
  paperSize: PaperSize
  density: Density
  fontFamily: FontFamily
  // Table styling
  accentHeader: boolean // fill the table header row with the accent color
  zebra: boolean // alternate row shading
  showPackagingColumn: boolean
  showDescriptionColumn: boolean
  // Content
  showSignatures: boolean
  footerText: string // custom footer line ('' → falls back to the legal name)
  defaultTerms: string // seeds the Notes area of new quotations
}

const STORAGE_KEY = 'venturo.quotationTemplate'

export const DEFAULT_QUOTATION_TEMPLATE: QuotationTemplate = {
  showLogo: true,
  logoPosition: 'left',
  logoSize: 'medium',
  titleLabel: 'QUOTATION',
  accentColor: '#4f46e5',
  paperSize: 'A4',
  density: 'normal',
  fontFamily: 'sans',
  accentHeader: false,
  zebra: false,
  showPackagingColumn: true,
  showDescriptionColumn: true,
  showSignatures: true,
  footerText: '',
  defaultTerms: '',
}

let template: QuotationTemplate = load()

function load(): QuotationTemplate {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_QUOTATION_TEMPLATE, ...(JSON.parse(raw) as Partial<QuotationTemplate>) }
  } catch {
    /* fall through to default */
  }
  return { ...DEFAULT_QUOTATION_TEMPLATE }
}

export function getQuotationTemplate(): QuotationTemplate {
  return { ...template }
}

export function updateQuotationTemplate(patch: Partial<QuotationTemplate>): QuotationTemplate {
  template = { ...template, ...patch }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(template))
  } catch {
    /* storage unavailable — keep in-memory value */
  }
  recordAuditEvent({ module: 'admin', action: 'Updated quotation layout' })
  return { ...template }
}
