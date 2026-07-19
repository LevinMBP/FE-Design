import { useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton, Tag } from 'antd'
import { ArrowLeft, Printer } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetQuotationQuery } from '../salesDocsApi'
import { peso, QUOTATION_STATUS } from '../salesDocMath'
import type { SignatureBlock } from '../types'
import './QuotationDetail.css'

const fmt = (d: string) => dayjs(d).format('MMM D, YYYY')

/** One signature block: drawn signature above the name line, role below. */
function SignatureSlot({
  role,
  block,
}: {
  role: string
  block?: SignatureBlock
}) {
  return (
    <div className="quote-sig">
      {block?.signature ? (
        <img className="quote-sig__img" src={block.signature} alt={`${role} signature`} />
      ) : (
        <div className="quote-sig__blank" />
      )}
      <div className="quote-sig__name">{block?.name || ' '}</div>
      <div className="quote-sig__role">{role}</div>
    </div>
  )
}

/**
 * Read-only document view of a quotation, styled as the paper it prints to.
 * The Print button prints just the document (app chrome is hidden by the
 * stylesheet's @media print rules).
 */
function QuotationDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: quote, isLoading } = useGetQuotationQuery(id ?? '', { skip: !id })

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="module-view">
        <div className="empty-state">
          This quotation doesn't exist (or was removed).
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => navigate('/sales/quotations')}>
              Back to quotations
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const status = QUOTATION_STATUS[quote.status]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Quotation {quote.reference}</h1>
          <p>
            {quote.customerName || 'No customer'} · {fmt(quote.date)}
          </p>
        </div>
        <div className="page-head__actions">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/sales/quotations')}>
            Back
          </Button>
          <Button type="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <div className="quote-doc">
        <div className="quote-doc__top">
          <div>
            <div className="quote-doc__kicker">Quotation</div>
            <div className="quote-doc__ref">{quote.reference}</div>
          </div>
          <Tag color={status.color}>{status.label}</Tag>
        </div>

        <div className="quote-doc__meta">
          <div>
            <h3>For</h3>
            <p>
              <strong>{quote.customerName || '—'}</strong>
              {quote.contactPerson && (
                <>
                  <br />
                  Attn: {quote.contactPerson}
                </>
              )}
              {quote.email && (
                <>
                  <br />
                  {quote.email}
                </>
              )}
              {quote.address && (
                <>
                  <br />
                  {quote.address}
                </>
              )}
            </p>
          </div>
          <div>
            <h3>Dates</h3>
            <p>
              Issued: <strong>{fmt(quote.date)}</strong>
              <br />
              Effective: {fmt(quote.effectiveDate)}
              <br />
              Valid until: {fmt(quote.expiryDate)}
            </p>
          </div>
        </div>

        <table className="quote-doc__lines">
          <thead>
            <tr>
              <th>Item</th>
              <th>Packaging</th>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l) => (
              <tr key={`${l.itemKind}:${l.itemId}`}>
                <td>{l.itemName}</td>
                <td>{l.packaging || '—'}</td>
                <td>{l.description || '—'}</td>
                <td className="num">
                  {l.quantity} {l.unit}
                </td>
                <td className="num">{peso(l.unitPrice)}</td>
                <td className="num">{peso(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="quote-doc__totals">
          <div className="quote-doc__totals-row">
            <span>Subtotal</span>
            <span>{peso(quote.subtotal)}</span>
          </div>
          {quote.discountAmount > 0 && (
            <div className="quote-doc__totals-row">
              <span>Discount</span>
              <span>− {peso(quote.discountAmount)}</span>
            </div>
          )}
          {quote.taxBreakdown.length === 0 ? (
            <div className="quote-doc__totals-row">
              <span>Tax</span>
              <span>{peso(0)}</span>
            </div>
          ) : (
            quote.taxBreakdown.map((t) => (
              <div className="quote-doc__totals-row" key={t.label}>
                <span>{t.label}</span>
                <span>{peso(t.amount)}</span>
              </div>
            ))
          )}
          <div className="quote-doc__totals-row is-total">
            <span>Total</span>
            <span>{peso(quote.total)}</span>
          </div>
        </div>

        {quote.notes && <p className="quote-doc__notes">{quote.notes}</p>}

        <div className="quote-doc__sigs">
          <SignatureSlot role="Prepared by" block={quote.preparedBy} />
          <SignatureSlot role="Approved by" block={quote.approvedBy} />
        </div>
      </div>
    </div>
  )
}

export default QuotationDetailPage
