import { applyPurchasePayment, getPurchase, listPurchases } from './mockPurchases'
import { listPaymentMethods, listTaxes } from '../finance/mockFinance'
import { listVendors } from '../contacts/mockContacts'
import { postVendorPaymentEntry } from '../accounting/autoPost'
import { EPSILON, isOpen, round2 } from '../../shared/settlement'
import {
  purchaseOutstanding,
  type NewVendorPayment,
  type Payment,
  type PaymentAllocation,
  type Purchase,
} from './types'

/**
 * Vendor payments — the AP settlement document.
 *
 *   vendor → allocation → purchase order
 *
 * One payment is money leaving through ONE payment method to ONE vendor on one
 * date, split across that vendor's open purchase orders. Each allocation
 * reduces its order's outstanding balance; the whole payment posts a single
 * entry, Dr Accounts Payable / Cr <the method's cash or bank account>.
 *
 * Everything is validated before anything is applied, so a payment either lands
 * in full or not at all — no half-settled orders. In-memory; resets on reload.
 */

const uid = () => `pmt_${crypto.randomUUID().slice(0, 8)}`
const pad3 = (n: number) => String(n).padStart(3, '0')

let payments: Payment[] = []
let pmtNo = 0

export function listPayments(): Payment[] {
  return [...payments]
}

/** The next auto payment reference, without consuming it (for form defaults). */
export function nextPaymentRef(): string {
  return `PMT-${pad3(pmtNo + 1)}`
}

/**
 * Purchase orders that still owe the vendor money, oldest first — the rows an
 * allocation is built from. Pass a vendor to scope it to that vendor's payables.
 */
export function listOpenPayables(vendorId?: string): Purchase[] {
  return listPurchases()
    .filter((p) => (vendorId ? p.vendorId === vendorId : true))
    .filter((p) => isOpen(p.netPayable, p.amountPaid))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function recordVendorPayment(input: NewVendorPayment): Payment {
  const vendor = listVendors().find((v) => v.id === input.vendorId)
  if (!vendor) throw new Error('Select a vendor.')

  const method = listPaymentMethods().find((m) => m.id === input.paymentMethodId)
  if (!method) throw new Error('Select a payment method.')
  if (!method.glAccountId) {
    throw new Error(`${method.name} has no cash/bank account set.`)
  }

  const lines = (input.allocations ?? [])
    .map((a) => ({
      purchaseId: a.purchaseId,
      amount: round2(a.amount),
      withholdingTax: round2(a.withholdingTax ?? 0),
    }))
    .filter((a) => a.amount > EPSILON)
  if (lines.length === 0) {
    throw new Error('Allocate the payment to at least one purchase order.')
  }
  if (new Set(lines.map((l) => l.purchaseId)).size !== lines.length) {
    throw new Error('A purchase order can only be allocated once per payment.')
  }

  // Withholding is carved out of what's allocated, so it must have a tax behind
  // it (that's the account it's credited to) and can never exceed the line.
  const withheld = round2(lines.reduce((s, l) => s + l.withholdingTax, 0))
  const withholdingTax = input.withholdingTaxId
    ? listTaxes().find((t) => t.id === input.withholdingTaxId)
    : undefined
  if (input.withholdingTaxId && !withholdingTax) {
    throw new Error('That withholding tax no longer exists.')
  }
  const withholdingAccountId = withholdingTax?.accounts.find(
    (a) => a.purpose === 'wht_payable',
  )?.glAccountId
  if (withheld > EPSILON) {
    if (!withholdingTax) {
      throw new Error('Pick the withholding tax so the amount posts to the right account.')
    }
    if (!withholdingAccountId) {
      throw new Error(`${withholdingTax.name} has no WHT payable account set.`)
    }
  }

  // Validate every allocation before touching a single order.
  const allocations: PaymentAllocation[] = lines.map((line) => {
    const purchase = getPurchase(line.purchaseId)
    if (!purchase) throw new Error('That purchase order no longer exists.')
    if (purchase.vendorId !== vendor.id) {
      throw new Error(
        `${purchase.reference} belongs to another vendor — pay it on its own payment.`,
      )
    }
    const outstanding = purchaseOutstanding(purchase)
    if (outstanding <= EPSILON) {
      throw new Error(`${purchase.reference} is already fully paid.`)
    }
    if (line.amount > outstanding + EPSILON) {
      throw new Error(
        `${purchase.reference}: ${line.amount.toFixed(2)} exceeds its outstanding ${outstanding.toFixed(2)}.`,
      )
    }
    if (line.withholdingTax < 0) {
      throw new Error(`${purchase.reference}: withholding tax can't be negative.`)
    }
    if (line.withholdingTax > line.amount + EPSILON) {
      throw new Error(
        `${purchase.reference}: withholding ${line.withholdingTax.toFixed(2)} exceeds the ${line.amount.toFixed(2)} allocated to it.`,
      )
    }
    return {
      purchaseId: purchase.id,
      purchaseRef: purchase.reference,
      purchaseDate: purchase.date,
      purchaseTotal: purchase.netPayable,
      amount: line.amount,
      withholdingTax: line.withholdingTax,
    }
  })

  const amount = round2(allocations.reduce((s, a) => s + a.amount, 0))
  for (const allocation of allocations) {
    applyPurchasePayment(allocation.purchaseId, allocation.amount)
  }

  const reference = `PMT-${pad3(++pmtNo)}`
  const record: Payment = {
    id: uid(),
    reference,
    date: input.date,
    vendorId: vendor.id,
    vendorName: vendor.company,
    paymentMethodId: method.id,
    paymentMethodName: method.name,
    note: input.note ?? '',
    allocations,
    amount,
    withholdingTaxId: withheld > EPSILON ? withholdingTax?.id : undefined,
    withholdingLabel:
      withheld > EPSILON && withholdingTax
        ? `${withholdingTax.name} ${withholdingTax.rate}%`
        : undefined,
    withholdingTotal: withheld,
    cashAmount: round2(amount - withheld),
  }
  payments = [record, ...payments]

  // One journal for the whole payment: Dr AP / Cr Cash-or-Bank / Cr WHT Payable.
  postVendorPaymentEntry({
    date: input.date,
    reference,
    party: record.vendorName,
    amount,
    creditAccountId: method.glAccountId,
    withholding: withheld,
    withholdingAccountId,
  })

  return record
}

/**
 * Seed a few payments so the list shows every settlement state — one order
 * fully paid, one part-paid, the rest still open. Seeded through
 * `recordVendorPayment` so the payables and the books stay in step.
 */
function seedPayments() {
  const byRef = new Map(listPurchases().map((p) => [p.reference, p]))

  const steel = byRef.get('PO-001')
  if (steel) {
    recordVendorPayment({
      date: '2026-03-20',
      vendorId: steel.vendorId,
      paymentMethodId: 'pm_bdo',
      note: 'Settled in full on terms.',
      allocations: [{ purchaseId: steel.id, amount: steel.netPayable }],
    })
  }

  const packaging = byRef.get('PO-002')
  if (packaging) {
    recordVendorPayment({
      date: '2026-04-10',
      vendorId: packaging.vendorId,
      paymentMethodId: 'pm_gcash',
      note: 'Part payment — balance on next cycle.',
      allocations: [{ purchaseId: packaging.id, amount: 800 }],
    })
  }

  // A service bill settled net of 2% expanded withholding — the vendor gets the
  // cash less the tax, and a 2307 for the balance.
  const freight = byRef.get('PO-004')
  if (freight) {
    recordVendorPayment({
      date: '2026-06-02',
      vendorId: freight.vendorId,
      paymentMethodId: 'pm_bdo',
      note: 'Freight billing cleared, net of EWT.',
      withholdingTaxId: 'tax_wht',
      allocations: [
        {
          purchaseId: freight.id,
          amount: freight.netPayable,
          withholdingTax: round2(freight.gross * 0.02),
        },
      ],
    })
  }
}
seedPayments()
