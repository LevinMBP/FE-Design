import { isOpen, outstandingOf } from '../../shared/settlement'
import type { Sale } from '../inventory/types'
import type { Invoice, OpenReceivable } from './types'

/**
 * What the customer owes, flattened across the two documents that debit
 * Accounts Receivable: issued invoices and sales orders. One definition of
 * "open", shared by the collection form and the backend that validates it, so
 * the screen can never offer a row the backend would reject.
 */

/** A draft invoice has posted nothing, and a void one is cancelled. */
const invoiceIsReceivable = (inv: Invoice) => inv.issued && inv.status !== 'void'

export function invoiceReceivable(inv: Invoice): OpenReceivable {
  return {
    kind: 'invoice',
    id: inv.id,
    reference: inv.reference,
    date: inv.date,
    dueDate: inv.dueDate,
    customerId: inv.customerId,
    customerName: inv.customerName,
    total: inv.total,
    // `gross` is the discounted, tax-exclusive base the output tax was added to.
    netBase: inv.gross,
    amountPaid: inv.amountPaid,
    outstanding: outstandingOf(inv.total, inv.amountPaid),
  }
}

export function saleReceivable(sale: Sale): OpenReceivable {
  return {
    kind: 'sale',
    id: sale.id,
    reference: sale.reference,
    date: sale.date,
    dueDate: '',
    customerId: sale.customerId,
    customerName: sale.customerName,
    total: sale.total,
    // Sales orders carry no tax, so the whole total is the base.
    netBase: sale.total,
    amountPaid: sale.amountPaid,
    outstanding: outstandingOf(sale.total, sale.amountPaid),
  }
}

/** Every still-unsettled receivable, oldest first, optionally by customer. */
export function openReceivables(
  invoices: Invoice[],
  sales: Sale[],
  customerId?: string,
): OpenReceivable[] {
  return [
    ...invoices.filter(invoiceIsReceivable).map(invoiceReceivable),
    ...sales.map(saleReceivable),
  ]
    .filter((r) => (customerId ? r.customerId === customerId : true))
    .filter((r) => isOpen(r.total, r.amountPaid))
    .sort((a, b) => a.date.localeCompare(b.date))
}
