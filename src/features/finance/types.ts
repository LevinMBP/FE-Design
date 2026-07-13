export type FinanceStatus = 'active' | 'inactive'

/**
 * The GL role a tax's account plays when a document posts, mirroring the
 * backend's `TaxAccountPurpose` enum.
 */
export type TaxAccountPurpose =
  | 'input_tax' // Purchase side, DR (VAT Input, Creditable WHT)
  | 'output_tax' // Sales side, CR (VAT Output)
  | 'wht_payable' // Purchase side, CR (WHT Payable)
  | 'wht_receivable' // Sales side, DR (Creditable WHT on sales)

/** A GL account a tax rate posts to for a given purpose. Mirrors `TaxRateAccount`. */
export interface TaxRateAccount {
  id: string
  glAccountId: string
  purpose: TaxAccountPurpose
}

export interface Tax {
  id: string
  name: string
  /** Percentage rate, e.g. 12 for 12% VAT. */
  rate: number
  description: string
  status: FinanceStatus
  accounts: TaxRateAccount[]
}

/** High-level category for a payment method. */
export type PaymentMethodType =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'digital_wallet'
  | 'cheque'
  | 'credit'

export interface PaymentMethod {
  id: string
  name: string
  type: PaymentMethodType
  /** Bank / provider name, e.g. "BDO" or "GCash". */
  provider: string
  /** Account or reference number, when applicable. */
  accountNumber: string
  /** GL account this method draws from / deposits to (cash or a bank account). */
  glAccountId: string
  description: string
  status: FinanceStatus
}

export type NewTaxRateAccount = Omit<TaxRateAccount, 'id'>
export type NewTax = Omit<Tax, 'id' | 'accounts'> & { accounts: NewTaxRateAccount[] }
export type NewPaymentMethod = Omit<PaymentMethod, 'id'>

/** Options for the tax account purpose field. */
export const TAX_ACCOUNT_PURPOSES: {
  value: TaxAccountPurpose
  label: string
  hint: string
}[] = [
  { value: 'input_tax', label: 'Input Tax', hint: 'Debited on purchase' },
  { value: 'output_tax', label: 'Output Tax', hint: 'Credited on sale' },
  { value: 'wht_payable', label: 'WHT Payable', hint: 'Credited on purchase' },
  { value: 'wht_receivable', label: 'WHT Receivable', hint: 'Debited on sale' },
]

/** Purposes that post when this tax is used on a purchase document. */
export const PURCHASE_TAX_PURPOSES: TaxAccountPurpose[] = ['input_tax', 'wht_payable']
/** Purposes that post when this tax is used on a sales document. */
export const SALES_TAX_PURPOSES: TaxAccountPurpose[] = ['output_tax', 'wht_receivable']

/** Options for the payment-method type field. */
export const PAYMENT_METHOD_TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'digital_wallet', label: 'Digital Wallet' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Credit' },
]

export function paymentMethodTypeLabel(type: PaymentMethodType): string {
  return PAYMENT_METHOD_TYPES.find((t) => t.value === type)?.label ?? type
}

export function taxAccountPurposeLabel(value: TaxAccountPurpose): string {
  return TAX_ACCOUNT_PURPOSES.find((p) => p.value === value)?.label ?? value
}

/** Active taxes with at least one account for the given purposes. */
function taxAppliesToPurposes(tax: Tax, purposes: TaxAccountPurpose[]): boolean {
  return tax.status === 'active' && tax.accounts.some((a) => purposes.includes(a.purpose))
}

/** Active taxes that can be applied to a purchase (input VAT, WHT payable). */
export function isPurchaseTax(tax: Tax): boolean {
  return taxAppliesToPurposes(tax, PURCHASE_TAX_PURPOSES)
}

/** Active taxes that can be applied to a sale (output VAT, WHT receivable). */
export function isSalesTax(tax: Tax): boolean {
  return taxAppliesToPurposes(tax, SALES_TAX_PURPOSES)
}
