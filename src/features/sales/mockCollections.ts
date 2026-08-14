import dayjs from 'dayjs'
import { applySalePayment, getSale, listSales } from '../inventory/mockSales'
import {
  applyInvoicePayment,
  getInvoice,
  listInvoices,
  seededSettledInvoiceIds,
} from './mockSalesDocs'
import { invoiceReceivable, openReceivables, saleReceivable } from './receivables'
import { listCustomers } from '../contacts/mockContacts'
import { listPaymentMethods, listTaxes } from '../finance/mockFinance'
import { postCollectionEntry } from '../accounting/autoPost'
import { EPSILON, round2, withholdingFor } from '../../shared/settlement'
import type {
  Collection,
  CollectionAllocation,
  NewCollection,
  OpenReceivable,
  ReceivableKind,
} from './types'

/**
 * Customer collections — the AR settlement document, the mirror image of a
 * vendor payment:
 *
 *   customer → allocation → invoice / sales order
 *
 * One collection is money received from ONE customer on one date into one
 * payment method, split across that customer's open documents. Each allocation
 * reduces its document's outstanding balance (an invoice flips to `paid` once
 * the whole total is in); the collection posts a single entry,
 * Dr <the method's cash or bank account> / Cr Accounts Receivable.
 *
 * Everything is validated before anything is applied, so a collection lands in
 * full or not at all. In-memory; resets on reload.
 */

const uid = () => `col_${crypto.randomUUID().slice(0, 8)}`
const pad3 = (n: number) => String(n).padStart(3, '0')

let collections: Collection[] = []
let colNo = 0

export function listCollections(): Collection[] {
  return [...collections]
}

/** The next auto collection reference, without consuming it (form defaults). */
export function nextCollectionRef(): string {
  return `COL-${pad3(colNo + 1)}`
}

/** Documents that still owe money, oldest first — the allocation rows. */
export function listOpenReceivables(customerId?: string): OpenReceivable[] {
  return openReceivables(listInvoices(), listSales(), customerId)
}

/**
 * Look a receivable up by kind, whichever store it lives in — settled ones
 * included, so the caller can say *why* a document can't take the money.
 */
function findReceivable(
  kind: ReceivableKind,
  id: string,
): OpenReceivable | undefined {
  if (kind === 'invoice') {
    const inv = getInvoice(id)
    if (!inv) return undefined
    if (!inv.issued) throw new Error(`${inv.reference} hasn't been sent yet.`)
    if (inv.status === 'void') throw new Error(`${inv.reference} is void.`)
    return invoiceReceivable(inv)
  }
  const sale = getSale(id)
  return sale ? saleReceivable(sale) : undefined
}

export function recordCollection(input: NewCollection): Collection {
  const customer = listCustomers().find((c) => c.id === input.customerId)
  if (!customer) throw new Error('Select a customer.')

  const method = listPaymentMethods().find((m) => m.id === input.paymentMethodId)
  if (!method) throw new Error('Select a payment method.')
  if (!method.glAccountId) {
    throw new Error(`${method.name} has no cash/bank account set.`)
  }

  const lines = (input.allocations ?? [])
    .map((a) => ({
      docKind: a.docKind,
      docId: a.docId,
      amount: round2(a.amount),
      withholdingTax: round2(a.withholdingTax ?? 0),
    }))
    .filter((a) => a.amount > EPSILON)
  if (lines.length === 0) {
    throw new Error('Allocate the collection to at least one document.')
  }
  const keys = lines.map((l) => `${l.docKind}:${l.docId}`)
  if (new Set(keys).size !== keys.length) {
    throw new Error('A document can only be allocated once per collection.')
  }

  // Withholding is carved out of what's collected, so it must have a tax behind
  // it (that's the account it's debited to) and can never exceed the line.
  const withheld = round2(lines.reduce((s, l) => s + l.withholdingTax, 0))
  const withholdingTax = input.withholdingTaxId
    ? listTaxes().find((t) => t.id === input.withholdingTaxId)
    : undefined
  if (input.withholdingTaxId && !withholdingTax) {
    throw new Error('That withholding tax no longer exists.')
  }
  const withholdingAccountId = withholdingTax?.accounts.find(
    (a) => a.purpose === 'wht_receivable',
  )?.glAccountId
  if (withheld > EPSILON) {
    if (!withholdingTax) {
      throw new Error('Pick the withholding tax so the amount posts to the right account.')
    }
    if (!withholdingAccountId) {
      throw new Error(`${withholdingTax.name} has no creditable WHT account set.`)
    }
  }

  // Validate every allocation before settling a single document.
  const allocations: CollectionAllocation[] = lines.map((line) => {
    const doc = findReceivable(line.docKind, line.docId)
    if (!doc) throw new Error('That document no longer exists.')
    if (doc.customerId !== customer.id) {
      throw new Error(
        `${doc.reference} belongs to another customer — collect it on its own receipt.`,
      )
    }
    if (doc.outstanding <= EPSILON) {
      throw new Error(`${doc.reference} is already fully settled.`)
    }
    if (line.amount > doc.outstanding + EPSILON) {
      throw new Error(
        `${doc.reference}: ${line.amount.toFixed(2)} exceeds its outstanding ${doc.outstanding.toFixed(2)}.`,
      )
    }
    if (line.withholdingTax < 0) {
      throw new Error(`${doc.reference}: withholding tax can't be negative.`)
    }
    if (line.withholdingTax > line.amount + EPSILON) {
      throw new Error(
        `${doc.reference}: withholding ${line.withholdingTax.toFixed(2)} exceeds the ${line.amount.toFixed(2)} allocated to it.`,
      )
    }
    return {
      docKind: doc.kind,
      docId: doc.id,
      docRef: doc.reference,
      docDate: doc.date,
      docTotal: doc.total,
      amount: line.amount,
      withholdingTax: line.withholdingTax,
    }
  })

  const amount = round2(allocations.reduce((s, a) => s + a.amount, 0))
  for (const allocation of allocations) {
    if (allocation.docKind === 'invoice') {
      applyInvoicePayment(allocation.docId, allocation.amount)
    } else {
      applySalePayment(allocation.docId, allocation.amount)
    }
  }

  const reference = `COL-${pad3(++colNo)}`
  const record: Collection = {
    id: uid(),
    reference,
    date: input.date,
    customerId: customer.id,
    customerName: customer.company,
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
  collections = [record, ...collections]

  // One journal: Dr Cash-or-Bank / Dr Creditable WHT / Cr Accounts Receivable.
  postCollectionEntry({
    date: input.date,
    reference,
    party: record.customerName,
    amount,
    debitAccountId: method.glAccountId,
    withholding: withheld,
    withholdingAccountId,
  })

  return record
}

/* ----------------------------- Seed data ----------------------------- */

/**
 * Settle the invoices the sales seed treats as paid, through the real document
 * so cash, AR and the invoice statuses all agree. Invoices for the same
 * customer that fall in the same week are collected together, which is what a
 * batch remittance looks like — and gives the list multi-allocation examples.
 * One recent invoice is collected in part, so the list shows a partial too.
 */
function seedCollections() {
  const settled = new Set(seededSettledInvoiceIds())
  const paid = listInvoices()
    .filter((i) => settled.has(i.id))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Group into batches: same customer, collected within 7 days of each other.
  const batches: (typeof paid)[] = []
  for (const inv of paid) {
    const batch = batches.find(
      (b) =>
        b[0].customerId === inv.customerId &&
        dayjs(inv.date).diff(dayjs(b[0].date), 'day') <= 7,
    )
    if (batch) batch.push(inv)
    else batches.push([inv])
  }

  for (const batch of batches) {
    const last = batch[batch.length - 1]
    // Received a few days after the newest invoice in the batch, never ahead of today.
    const received = dayjs(last.date).add(4, 'day')
    const date = (received.isAfter(dayjs()) ? dayjs() : received).format('YYYY-MM-DD')
    recordCollection({
      date,
      customerId: batch[0].customerId,
      paymentMethodId: 'pm_bdo',
      note: batch.length > 1 ? 'Batch remittance.' : '',
      allocations: batch.map((inv) => ({
        docKind: 'invoice' as const,
        docId: inv.id,
        amount: inv.total,
      })),
    })
  }

  // A part payment on the oldest still-open invoice, with the customer holding
  // back 1% creditable withholding — cash short, receivable cleared in full.
  const open = listOpenReceivables().filter((r) => r.kind === 'invoice')
  const partial = open[0]
  if (partial) {
    const amount = round2(partial.outstanding * 0.4)
    recordCollection({
      date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
      customerId: partial.customerId,
      paymentMethodId: 'pm_gcash',
      note: 'Part payment net of 1% CWT — balance promised next week.',
      withholdingTaxId: 'tax_wht_recv',
      allocations: [
        {
          docKind: partial.kind,
          docId: partial.id,
          amount,
          withholdingTax: withholdingFor(partial, amount, 1),
        },
      ],
    })
  }
}
seedCollections()
