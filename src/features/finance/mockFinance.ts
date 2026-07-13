import type {
  NewPaymentMethod,
  NewTax,
  PaymentMethod,
  Tax,
} from './types'

/**
 * In-memory mock finance "database", mirroring `contacts/mockContacts.ts`.
 * The financeApi endpoints call these and invalidate RTK Query tags so lists
 * refetch. Replace with real HTTP later without touching the components.
 */

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

let taxes: Tax[] = [
  { id: 'tax_vat', name: 'VAT', rate: 12, computation: 'exclusive', appliesTo: 'both', description: 'Standard value-added tax.', status: 'active' },
  { id: 'tax_vat_zero', name: 'Zero-rated VAT', rate: 0, computation: 'exclusive', appliesTo: 'sales', description: 'Export and zero-rated sales.', status: 'active' },
  { id: 'tax_wht', name: 'Withholding Tax', rate: 2, computation: 'exclusive', appliesTo: 'purchases', description: 'Expanded withholding tax on suppliers.', status: 'active' },
  { id: 'tax_exempt', name: 'VAT Exempt', rate: 0, computation: 'exclusive', appliesTo: 'both', description: 'Exempt goods and services.', status: 'inactive' },
]

let paymentMethods: PaymentMethod[] = [
  { id: 'pm_cash', name: 'Cash', type: 'cash', provider: '', accountNumber: '', glAccountId: 'acc_cash', description: 'Over-the-counter cash payments.', status: 'active' },
  { id: 'pm_bdo', name: 'BDO Checking', type: 'bank_transfer', provider: 'BDO', accountNumber: '0012-3456-7890', glAccountId: 'acc_bank', description: 'Primary operating account.', status: 'active' },
  { id: 'pm_gcash', name: 'GCash', type: 'digital_wallet', provider: 'GCash', accountNumber: '0917 555 0100', glAccountId: 'acc_bank', description: 'Mobile wallet collections.', status: 'active' },
  { id: 'pm_visa', name: 'Company Visa', type: 'card', provider: 'Visa', accountNumber: '**** 4242', glAccountId: 'acc_bank', description: 'Corporate card for purchases.', status: 'active' },
  { id: 'pm_cheque', name: 'Cheque', type: 'cheque', provider: '', accountNumber: '', glAccountId: 'acc_bank', description: 'Issued and received cheques.', status: 'inactive' },
]

export function listTaxes(): Tax[] {
  return [...taxes]
}
export function addTax(input: NewTax): Tax {
  const record: Tax = { id: uid('tax'), ...input }
  taxes = [record, ...taxes]
  return record
}

export function listPaymentMethods(): PaymentMethod[] {
  return [...paymentMethods]
}
export function addPaymentMethod(input: NewPaymentMethod): PaymentMethod {
  const record: PaymentMethod = { id: uid('pm'), ...input }
  paymentMethods = [record, ...paymentMethods]
  return record
}
