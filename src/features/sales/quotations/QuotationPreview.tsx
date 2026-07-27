import { useMemo } from 'react'
import { Form, type FormInstance } from 'antd'
import type { Dayjs } from 'dayjs'
import type { StockItem } from '../../inventory/types'
import type { Customer } from '../../contacts/types'
import type { Tax } from '../../finance/types'
import { computeTotals } from '../salesDocMath'
import {
  itemValue,
  type ItemMeta,
  type LineFieldValues,
} from '../salesFormShared'
import type { DiscountType, SignatureBlock } from '../types'
import QuotationDocument, { type QuotationDoc, type QuotationDocLine } from './QuotationDocument'

interface Props {
  form: FormInstance
  items: StockItem[]
  itemMeta: Map<string, ItemMeta>
  customers: Customer[]
  taxes: Tax[]
}

const isoDate = (d?: Dayjs) => (d ? d.format('YYYY-MM-DD') : '')

const sig = (v: unknown): SignatureBlock | undefined => {
  const b = v as Partial<SignatureBlock> | undefined
  const name = b?.name?.trim() ?? ''
  const signature = b?.signature ?? ''
  return name || signature ? { name, signature } : undefined
}

/**
 * Live "what it exports to" preview: reads the quotation form's current values
 * (via Form.useWatch) and renders the exact same paper document as the detail
 * page. Money is computed with the same `computeTotals` the footer/back-end use.
 */
function QuotationPreview({ form, items, itemMeta, customers, taxes }: Props) {
  const lines = (Form.useWatch('lines', form) ?? []) as LineFieldValues[]
  const customerId = Form.useWatch('customerId', form) as string | undefined
  const contactPerson = Form.useWatch('contactPerson', form) as string | undefined
  const email = Form.useWatch('email', form) as string | undefined
  const address = Form.useWatch('address', form) as string | undefined
  const date = Form.useWatch('date', form) as Dayjs | undefined
  const effectiveDate = Form.useWatch('effectiveDate', form) as Dayjs | undefined
  const expiryDate = Form.useWatch('expiryDate', form) as Dayjs | undefined
  const discountType = (Form.useWatch('discountType', form) ?? 'amount') as DiscountType
  const discountValue = (Form.useWatch('discountValue', form) ?? 0) as number
  const notes = Form.useWatch('notes', form) as string | undefined
  const preparedBy = Form.useWatch('preparedBy', form)
  const approvedBy = Form.useWatch('approvedBy', form)

  const itemsByValue = useMemo(() => new Map(items.map((i) => [itemValue(i), i])), [items])

  const doc: QuotationDoc = useMemo(() => {
    const docLines: QuotationDocLine[] = (lines ?? [])
      .filter((l) => l?.item)
      .map((l) => {
        const stock = itemsByValue.get(l.item as string)
        const meta = itemMeta.get(l.item as string)
        const [kind, id] = (l.item as string).split(':')
        return {
          itemKind: kind,
          itemId: id,
          itemName: stock?.name ?? '—',
          packaging: l.packaging ?? meta?.packaging ?? '',
          description: l.description ?? meta?.description ?? '',
          quantity: l.quantity ?? 0,
          unit: stock?.unit ?? '',
          unitPrice: l.unitPrice ?? meta?.price ?? 0,
        }
      })

    const totals = computeTotals(
      (lines ?? []).map((l) => ({
        quantity: l?.quantity ?? 0,
        unitPrice: l?.unitPrice ?? 0,
        taxIds: l?.taxIds ?? [],
        taxIncluded: !!l?.taxIncluded,
      })),
      discountType,
      discountValue,
      taxes,
    )

    return {
      reference: 'Preview',
      status: 'draft',
      customerName: customers.find((c) => c.id === customerId)?.company ?? '',
      contactPerson,
      email,
      address,
      date: isoDate(date),
      effectiveDate: isoDate(effectiveDate),
      expiryDate: isoDate(expiryDate),
      lines: docLines,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxBreakdown: totals.taxBreakdown,
      total: totals.total,
      notes: notes?.trim() || undefined,
      preparedBy: sig(preparedBy),
      approvedBy: sig(approvedBy),
    }
  }, [
    lines, itemsByValue, itemMeta, discountType, discountValue, taxes, customers,
    customerId, contactPerson, email, address, date, effectiveDate, expiryDate,
    notes, preparedBy, approvedBy,
  ])

  return <QuotationDocument doc={doc} />
}

export default QuotationPreview
