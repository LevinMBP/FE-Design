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
  {
    id: 'tax_vat',
    name: 'VAT',
    rate: 12,
    description: 'Standard value-added tax.',
    status: 'active',
    accounts: [
      { id: 'txa_vat_in', glAccountId: 'acc_vat_in', purpose: 'input_tax' },
      { id: 'txa_vat_out', glAccountId: 'acc_vat_out', purpose: 'output_tax' },
    ],
  },
  {
    id: 'tax_vat_zero',
    name: 'Zero-rated VAT',
    rate: 0,
    description: 'Export and zero-rated sales.',
    status: 'active',
    accounts: [{ id: 'txa_vat_zero_out', glAccountId: 'acc_vat_out', purpose: 'output_tax' }],
  },
  {
    id: 'tax_wht',
    name: 'Withholding Tax',
    rate: 2,
    description: 'Expanded withholding tax on suppliers.',
    status: 'active',
    accounts: [{ id: 'txa_wht_payable', glAccountId: 'acc_wht', purpose: 'wht_payable' }],
  },
  {
    id: 'tax_wht_recv',
    name: 'Creditable WHT (Sales)',
    rate: 1,
    description: 'Tax withheld by customers on sales, creditable against income tax.',
    status: 'active',
    accounts: [{ id: 'txa_wht_recv', glAccountId: 'acc_wht_recv', purpose: 'wht_receivable' }],
  },
  {
    id: 'tax_exempt',
    name: 'VAT Exempt',
    rate: 0,
    description: 'Exempt goods and services.',
    status: 'inactive',
    accounts: [
      { id: 'txa_exempt_in', glAccountId: 'acc_vat_in', purpose: 'input_tax' },
      { id: 'txa_exempt_out', glAccountId: 'acc_vat_out', purpose: 'output_tax' },
    ],
  },
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
  const record: Tax = {
    id: uid('tax'),
    ...input,
    accounts: input.accounts.map((a) => ({ id: uid('txa'), ...a })),
  }
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
