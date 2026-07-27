import { recordAuditEvent } from './mockAuditLog'

/** Org-wide company profile the app can read (currency, fiscal year, identity). */
export interface CompanyProfile {
  name: string
  legalName: string
  email: string
  phone: string
  address: string
  currency: string // ISO code, e.g. 'PHP'
  fiscalYearStart: string // month name, e.g. 'January'
  /** Full logo image as a data URI (base64). Empty/undefined when unset. */
  logo?: string
  /** Square app icon as a data URI (base64); also used as the browser favicon. */
  icon?: string
}

const STORAGE_KEY = 'venturo.company'

const DEFAULT_COMPANY: CompanyProfile = {
  name: 'Venturo Inc.',
  legalName: 'Venturo Incorporated',
  email: 'hello@venturo.app',
  phone: '+63 2 8123 4567',
  address: '123 Ayala Ave, Makati City, Metro Manila',
  currency: 'PHP',
  fiscalYearStart: 'January',
}

let company: CompanyProfile = load()

function load(): CompanyProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_COMPANY, ...(JSON.parse(raw) as Partial<CompanyProfile>) }
  } catch {
    /* fall through to default */
  }
  return { ...DEFAULT_COMPANY }
}

export function getCompany(): CompanyProfile {
  return { ...company }
}

export function updateCompany(patch: Partial<CompanyProfile>): CompanyProfile {
  company = { ...company, ...patch }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(company))
  } catch {
    /* storage unavailable — keep in-memory value */
  }
  recordAuditEvent({ module: 'admin', action: 'Updated company profile', target: company.name })
  return { ...company }
}
