import type { CSSProperties } from 'react'
import dayjs from 'dayjs'
import { useGetCompanyQuery, useGetQuotationTemplateQuery } from '../../admin/adminApi'
import {
  DEFAULT_QUOTATION_TEMPLATE,
  type QuotationTemplate,
} from '../../admin/mockQuotationTemplate'
import { peso, QUOTATION_STATUS } from '../salesDocMath'
import type { QuotationStatus, SignatureBlock, TaxBreakdownRow } from '../types'
import './QuotationDetail.css'

const fmt = (d?: string) => (d ? dayjs(d).format('MMM D, YYYY') : '—')

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

/** One line as the document renders it (resolved names, not raw form values). */
export interface QuotationDocLine {
  itemKind: string
  itemId: string
  itemName: string
  packaging?: string
  description?: string
  quantity: number
  unit: string
  unitPrice: number
}

/**
 * The exact data the paper document needs. The stored `Quotation` satisfies
 * this structurally, and the form preview builds one from live values — so the
 * on-screen preview is identical to what prints/exports.
 */
export interface QuotationDoc {
  reference: string
  status: QuotationStatus
  customerName: string
  contactPerson?: string
  email?: string
  address?: string
  date: string
  effectiveDate: string
  expiryDate: string
  lines: QuotationDocLine[]
  subtotal: number
  discountAmount: number
  taxBreakdown: TaxBreakdownRow[]
  total: number
  notes?: string
  preparedBy?: SignatureBlock
  approvedBy?: SignatureBlock
}

/** A rendered table column, gated by the template + weighted for its width. */
interface Column {
  key: string
  label: string
  weight: number
  num?: boolean
  itemStyle?: boolean
  render: (l: QuotationDocLine) => string
}

/** One signature block: drawn signature above the name line, role below. */
function SignatureSlot({ role, block }: { role: string; block?: SignatureBlock }) {
  return (
    <div className="qd-sig">
      {block?.signature ? (
        <img className="qd-sig__img" src={block.signature} alt={`${role} signature`} />
      ) : (
        <div className="qd-sig__blank" />
      )}
      <div className="qd-sig__name">{block?.name || ' '}</div>
      <div className="qd-sig__role">{role}</div>
    </div>
  )
}

/**
 * A quotation rendered as an A4 page, mimicking the PDF the backend produces
 * (QuestPDF). White paper with dark ink in both themes. Layout is shaped by the
 * admin-managed `QuotationTemplate`; pass `template` to preview an unsaved draft
 * (e.g. from the layout editor), otherwise the saved template is used.
 */
function QuotationDocument({
  doc,
  template,
}: {
  doc: QuotationDoc
  template?: QuotationTemplate
}) {
  const { data: company } = useGetCompanyQuery()
  const { data: savedTemplate } = useGetQuotationTemplateQuery()
  const tpl = template ?? savedTemplate ?? DEFAULT_QUOTATION_TEMPLATE
  const status = QUOTATION_STATUS[doc.status]

  const companyName = company?.name || 'Your Company'
  const companyMeta = [company?.address, company?.email, company?.phone].filter(Boolean)

  const columnDefs: (Column | false)[] = [
    { key: 'item', label: 'Item', weight: 21, itemStyle: true, render: (l) => l.itemName },
    tpl.showPackagingColumn &&
      { key: 'packaging', label: 'Packaging', weight: 13, render: (l) => l.packaging || '—' },
    tpl.showDescriptionColumn &&
      { key: 'description', label: 'Description', weight: 27, render: (l) => l.description || '—' },
    { key: 'qty', label: 'Qty', weight: 11, num: true, render: (l) => `${l.quantity} ${l.unit}` },
    { key: 'unit', label: 'Unit price', weight: 14, num: true, render: (l) => peso(l.unitPrice) },
    { key: 'amount', label: 'Amount', weight: 14, num: true, render: (l) => peso(l.quantity * l.unitPrice) },
  ]
  const columns = columnDefs.filter((c): c is Column => c !== false)
  const totalWeight = columns.reduce((s, c) => s + c.weight, 0)
  const width = (c: Column) => `${((c.weight / totalWeight) * 100).toFixed(3)}%`

  const brand = (
    <div className="qd-brand">
      {tpl.showLogo && company?.logo ? (
        <img className="qd-brand__logo" src={company.logo} alt={`${companyName} logo`} />
      ) : tpl.showLogo ? (
        <div className="qd-brand__mark">{initials(companyName)}</div>
      ) : null}
      <div className="qd-brand__text">
        <div className="qd-brand__name">{companyName}</div>
        {companyMeta.map((line) => (
          <div className="qd-brand__meta" key={line}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )

  const title = (
    <div className="qd-title">
      <div className="qd-title__word">{tpl.titleLabel || 'QUOTATION'}</div>
      <div className="qd-title__ref">{doc.reference}</div>
      <div className={`qd-badge qd-badge--${doc.status}`}>{status.label}</div>
    </div>
  )

  return (
    <div
      className="pdf-page"
      data-paper={tpl.paperSize}
      data-density={tpl.density}
      data-font={tpl.fontFamily}
      data-logo={tpl.logoSize}
      data-zebra={tpl.zebra ? 'on' : undefined}
      data-accent-header={tpl.accentHeader ? 'on' : undefined}
      style={{ '--qd-accent': tpl.accentColor || '#4f46e5' } as CSSProperties}
    >
      <div className="pdf-page__inner">
        {/* Letterhead */}
        <header className={`qd-head${tpl.logoPosition === 'right' ? ' qd-head--logo-right' : ''}`}>
          {brand}
          {title}
        </header>

        <div className="qd-rule" />

        {/* Parties + dates */}
        <div className="qd-parties">
          <div>
            <div className="qd-parties__label">Bill to</div>
            <div className="qd-parties__name">{doc.customerName || '—'}</div>
            {doc.contactPerson && <div>Attn: {doc.contactPerson}</div>}
            {doc.email && <div>{doc.email}</div>}
            {doc.address && <div>{doc.address}</div>}
          </div>
          <div className="qd-parties__dates">
            <div className="qd-kv">
              <span>Issued</span>
              <strong>{fmt(doc.date)}</strong>
            </div>
            <div className="qd-kv">
              <span>Effective</span>
              <span>{fmt(doc.effectiveDate)}</span>
            </div>
            <div className="qd-kv">
              <span>Valid until</span>
              <span>{fmt(doc.expiryDate)}</span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="qd-table">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: width(c) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.num ? 'num' : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.lines.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="qd-table__empty">
                  No items yet.
                </td>
              </tr>
            ) : (
              doc.lines.map((l) => (
                <tr key={`${l.itemKind}:${l.itemId}`}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={[c.num ? 'num' : '', c.itemStyle ? 'qd-table__item' : '']
                        .filter(Boolean)
                        .join(' ') || undefined}
                    >
                      {c.render(l)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="qd-totals">
          <div className="qd-totals__row">
            <span>Subtotal</span>
            <span>{peso(doc.subtotal)}</span>
          </div>
          {doc.discountAmount > 0 && (
            <div className="qd-totals__row">
              <span>Discount</span>
              <span>− {peso(doc.discountAmount)}</span>
            </div>
          )}
          {doc.taxBreakdown.length === 0 ? (
            <div className="qd-totals__row">
              <span>Tax</span>
              <span>{peso(0)}</span>
            </div>
          ) : (
            doc.taxBreakdown.map((t) => (
              <div className="qd-totals__row" key={t.label}>
                <span>{t.label}</span>
                <span>{peso(t.amount)}</span>
              </div>
            ))
          )}
          <div className="qd-totals__row qd-totals__row--grand">
            <span>Total</span>
            <span>{peso(doc.total)}</span>
          </div>
        </div>

        {doc.notes && (
          <div className="qd-notes">
            <div className="qd-notes__label">Notes</div>
            <p>{doc.notes}</p>
          </div>
        )}

        {/* Signatures */}
        {tpl.showSignatures && (
          <div className="qd-sigs">
            <SignatureSlot role="Prepared by" block={doc.preparedBy} />
            <SignatureSlot role="Approved by" block={doc.approvedBy} />
          </div>
        )}

        {/* Footer band, pinned to the bottom of the page */}
        <footer className="qd-foot">
          <span className="qd-foot__note">{tpl.footerText || company?.legalName || companyName}</span>
          <span className="qd-foot__meta">{doc.reference} · Generated by Venturo</span>
        </footer>
      </div>
    </div>
  )
}

export default QuotationDocument
