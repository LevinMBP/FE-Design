import { applyPurchasePayment, getPurchase } from './mockPurchases'
import { listPaymentMethods } from '../finance/mockFinance'
import { postVendorPaymentEntry } from '../accounting/autoPost'
import { purchasePaymentStatus, type NewVendorPayment, type Payment } from './types'

/**
 * Vendor payments — settling a purchase's payable. Each payment reduces what's
 * owed on the purchase and posts Dr Accounts Payable / Cr <the payment method's
 * cash/bank account>. Supports partial payments (pay up to the outstanding
 * balance). In-memory; resets on reload.
 */

const uid = () => `pmt_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100
const pad3 = (n: number) => String(n).padStart(3, '0')

let payments: Payment[] = []
let pmtNo = 0

export function listPayments(): Payment[] {
  return [...payments]
}

export function recordVendorPayment(input: NewVendorPayment): Payment {
  const purchase = getPurchase(input.purchaseId)
  if (!purchase) throw new Error('That purchase no longer exists.')

  const outstanding = round2(purchase.netPayable - purchase.amountPaid)
  if (purchasePaymentStatus(purchase) === 'paid' || outstanding <= 0) {
    throw new Error('This purchase is already fully paid.')
  }
  const amount = round2(input.amount)
  if (amount <= 0) throw new Error('Enter a payment amount greater than 0.')
  if (amount > outstanding + 0.005) {
    throw new Error(
      `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`,
    )
  }

  const method = listPaymentMethods().find((m) => m.id === input.paymentMethodId)
  if (!method) throw new Error('Select a payment method.')
  if (!method.glAccountId) {
    throw new Error(`${method.name} has no cash/bank account set.`)
  }

  // Reduce the payable on the purchase, then record + post.
  applyPurchasePayment(purchase.id, amount)
  const reference = `PMT-${pad3(++pmtNo)}`
  const record: Payment = {
    id: uid(),
    reference,
    date: input.date,
    purchaseId: purchase.id,
    purchaseRef: purchase.reference,
    vendorId: purchase.vendorId,
    vendorName: purchase.vendorName,
    paymentMethodId: method.id,
    paymentMethodName: method.name,
    amount,
  }
  payments = [record, ...payments]

  // Dr Accounts Payable / Cr Cash-or-Bank.
  postVendorPaymentEntry({
    date: input.date,
    reference,
    party: purchase.vendorName,
    amount,
    creditAccountId: method.glAccountId,
  })

  return record
}
