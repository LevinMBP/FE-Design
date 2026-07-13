export type FinanceStatus = 'active' | 'inactive'

/** Whether a tax rate is added on top of (exclusive) or already baked into (inclusive) a price. */
export type TaxComputation = 'exclusive' | 'inclusive'

/** Where a tax applies in the transaction flow. */
export type TaxAppliesTo = 'sales' | 'purchases' | 'both'

export interface Tax {
  id: string
  name: string
  /** Percentage rate, e.g. 12 for 12% VAT. */
  rate: number
  computation: TaxComputation
  appliesTo: TaxAppliesTo
  description: string
  status: FinanceStatus
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

export type NewTax = Omit<Tax, 'id'>
export type NewPaymentMethod = Omit<PaymentMethod, 'id'>

/** Options for the tax "applies to" field. */
export const TAX_APPLIES_TO: { value: TaxAppliesTo; label: string }[] = [
  { value: 'sales', label: 'Sales' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'both', label: 'Sales & Purchases' },
]

/** Options for the tax computation field. */
export const TAX_COMPUTATIONS: { value: TaxComputation; label: string }[] = [
  { value: 'exclusive', label: 'Exclusive (added on top)' },
  { value: 'inclusive', label: 'Inclusive (baked into price)' },
]

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

export function taxAppliesToLabel(value: TaxAppliesTo): string {
  return TAX_APPLIES_TO.find((t) => t.value === value)?.label ?? value
}
