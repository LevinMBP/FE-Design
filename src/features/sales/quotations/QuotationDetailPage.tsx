import { useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton } from 'antd'
import { ArrowLeft, Printer } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetQuotationQuery } from '../salesDocsApi'
import QuotationDocument from './QuotationDocument'
import './QuotationDetail.css'

const fmt = (d: string) => dayjs(d).format('MMM D, YYYY')

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

      <QuotationDocument doc={quote} />
    </div>
  )
}

export default QuotationDetailPage
