import type { CSSProperties, ReactNode } from 'react'
import dayjs from 'dayjs'
import { useGetCompanyQuery, useGetQuotationTemplateQuery } from '../../admin/adminApi'
import {
  DEFAULT_QUOTATION_TEMPLATE,
  PAGE_SIZES,
  type ColumnConfig,
  type MetaRow,
  type QuotationTemplate,
  type SectionConfig,
  type SignatureSlotConfig,
} from '../../admin/mockQuotationTemplate'
import { amountInWords, peso, QUOTATION_STATUS } from '../salesDocMath'
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

/** Currency words for the "amount in words" line, keyed by ISO code. */
const CURRENCY_WORDS: Record<string, [string, string]> = {
  PHP: ['pesos', 'centavos'],
  USD: ['dollars', 'cents'],
  EUR: ['euros', 'cents'],
  SGD: ['dollars', 'cents'],
  JPY: ['yen', 'sen'],
}

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
 * A quotation rendered as a page of paper, mimicking the PDF the backend
 * produces (QuestPDF). White paper with dark ink in both themes.
 *
 * Every visual decision — page size, margins, colours, the letterhead shape,
 * which columns appear and in what order, the order of the body sections, the
 * totals wording, the signature slots — comes from the admin-managed
 * `QuotationTemplate`. Pass `template` to render an unsaved draft (the layout
 * editor's live preview); otherwise the org's active template is used.
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

  /* ---- page geometry ---- */
  const paper = PAGE_SIZES[tpl.paperSize] ?? PAGE_SIZES.A4
  const landscape = tpl.orientation === 'landscape'
  const pageWidth = landscape ? paper.height : paper.width
  const pageHeight = landscape ? paper.width : paper.height

  /* ---- table columns ---- */
  const columns = tpl.columns.filter(
    (c) => c.visible && !(c.key === 'description' && tpl.table.descriptionUnderItem),
  )
  const totalWeight = columns.reduce((s, c) => s + (c.weight || 1), 0) || 1
  const colWidth = (c: ColumnConfig) => `${(((c.weight || 1) / totalWeight) * 100).toFixed(3)}%`
  const isNumeric = (c: ColumnConfig) =>
    c.key === 'qty' || c.key === 'unitPrice' || c.key === 'amount' || c.key === 'rowNo'

  const cell = (c: ColumnConfig, line: QuotationDocLine, index: number): ReactNode => {
    switch (c.key) {
      case 'rowNo':
        return index + 1
      case 'item':
        return tpl.table.descriptionUnderItem && line.description ? (
          <>
            <div>{line.itemName}</div>
            <div className="qd-table__sub">{line.description}</div>
          </>
        ) : (
          line.itemName
        )
      case 'packaging':
        return line.packaging || '—'
      case 'description':
        return line.description || '—'
      case 'qty':
        return `${line.quantity}`
      case 'uom':
        return line.unit || '—'
      case 'unitPrice':
        return peso(line.unitPrice)
      case 'amount':
        return peso(line.quantity * line.unitPrice)
      default:
        return null
    }
  }

  /* ---- letterhead ---- */
  const companyMeta = [
    tpl.companyFields.address && company?.address,
    tpl.companyFields.email && company?.email,
    tpl.companyFields.phone && company?.phone,
  ].filter((v): v is string => !!v)

  const brand = (
    <div className="qd-brand">
      {tpl.showLogo && company?.logo ? (
        <img className="qd-brand__logo" src={company.logo} alt={`${companyName} logo`} />
      ) : tpl.showLogo ? (
        <div className="qd-brand__mark">{initials(companyName)}</div>
      ) : null}
      <div className="qd-brand__text">
        {tpl.companyFields.name && <div className="qd-brand__name">{companyName}</div>}
        {companyMeta.map((line) => (
          <div className="qd-brand__meta" key={line}>
            {line}
          </div>
        ))}
        {tpl.headerNote && <div className="qd-brand__note">{tpl.headerNote}</div>}
      </div>
    </div>
  )

  const title = (
    <div className="qd-title">
      <div className="qd-title__word">{tpl.titleLabel || 'QUOTATION'}</div>
      {tpl.subtitle && <div className="qd-title__sub">{tpl.subtitle}</div>}
      {tpl.showReference && <div className="qd-title__ref">{doc.reference}</div>}
      {tpl.showStatusBadge && (
        <div className={`qd-badge qd-badge--${doc.status}`}>{status.label}</div>
      )}
    </div>
  )

  /* ---- meta rows (issued / valid until / client-defined) ---- */
  const metaValue = (row: MetaRow) => {
    switch (row.source) {
      case 'reference':
        return doc.reference
      case 'status':
        return status.label
      case 'date':
        return fmt(doc.date)
      case 'effectiveDate':
        return fmt(doc.effectiveDate)
      case 'expiryDate':
        return fmt(doc.expiryDate)
      case 'customer':
        return doc.customerName || '—'
      case 'static':
        return row.value
      default:
        return ''
    }
  }

  /* ---- body sections ---- */
  const partiesBlock = (
    <div className="qd-parties">
      <div className="qd-parties__to">
        <div className="qd-label">{tpl.billToLabel || 'Bill to'}</div>
        <div className="qd-parties__name">{doc.customerName || '—'}</div>
        {tpl.partyFields.contactPerson && doc.contactPerson && <div>Attn: {doc.contactPerson}</div>}
        {tpl.partyFields.email && doc.email && <div>{doc.email}</div>}
        {tpl.partyFields.address && doc.address && <div>{doc.address}</div>}
      </div>
      {tpl.metaRows.some((r) => r.visible) && (
        <div className="qd-parties__dates">
          {tpl.metaRows
            .filter((r) => r.visible)
            .map((row) => (
              <div className="qd-kv" key={row.id}>
                <span>{row.label}</span>
                <span>{metaValue(row) || '—'}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )

  const padRows = Math.max(0, (tpl.table.minRows || 0) - doc.lines.length)

  const itemsBlock = (
    <table className="qd-table">
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={{ width: colWidth(c) }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ textAlign: c.align }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {doc.lines.length === 0 ? (
          <tr>
            <td colSpan={Math.max(columns.length, 1)} className="qd-table__empty">
              No items yet.
            </td>
          </tr>
        ) : (
          doc.lines.map((l, i) => (
            <tr key={`${l.itemKind}:${l.itemId}:${i}`}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{ textAlign: c.align }}
                  className={[isNumeric(c) ? 'num' : '', c.key === 'item' ? 'qd-table__item' : '']
                    .filter(Boolean)
                    .join(' ') || undefined}
                >
                  {cell(c, l, i)}
                </td>
              ))}
            </tr>
          ))
        )}
        {Array.from({ length: padRows }, (_, i) => (
          <tr key={`pad-${i}`} className="qd-table__pad">
            {columns.map((c) => (
              <td key={c.key}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const [majorWord, minorWord] = CURRENCY_WORDS[company?.currency ?? 'PHP'] ?? [
    (company?.currency ?? 'PHP').toLowerCase(),
    'cents',
  ]

  const totalsBlock = (
    <div className="qd-totals-wrap">
      {tpl.totals.amountInWords && (
        <div className="qd-words">
          <div className="qd-label">Amount in words</div>
          <div>{amountInWords(doc.total, majorWord, minorWord)}</div>
        </div>
      )}
      <div className="qd-totals">
        <div className="qd-totals__row">
          <span>{tpl.totals.subtotalLabel}</span>
          <span>{peso(doc.subtotal)}</span>
        </div>
        {doc.discountAmount > 0 && (
          <div className="qd-totals__row">
            <span>{tpl.totals.discountLabel}</span>
            <span>− {peso(doc.discountAmount)}</span>
          </div>
        )}
        {tpl.totals.showTaxLines &&
          (doc.taxBreakdown.length === 0
            ? tpl.totals.showZeroTax && (
                <div className="qd-totals__row">
                  <span>Tax</span>
                  <span>{peso(0)}</span>
                </div>
              )
            : doc.taxBreakdown.map((t) => (
                <div className="qd-totals__row" key={t.label}>
                  <span>{t.label}</span>
                  <span>{peso(t.amount)}</span>
                </div>
              )))}
        <div className="qd-totals__row qd-totals__row--grand">
          <span>{tpl.totals.grandTotalLabel}</span>
          <span>
            {tpl.totals.showCurrencyCode && `${company?.currency ?? 'PHP'} `}
            {peso(doc.total)}
          </span>
        </div>
      </div>
    </div>
  )

  const signatureBlockFor = (slot: SignatureSlotConfig) =>
    slot.source === 'preparedBy' ? doc.preparedBy : slot.source === 'approvedBy' ? doc.approvedBy : undefined

  const visibleSignatures = tpl.signatures.filter((s) => s.visible)
  const signaturesBlock = visibleSignatures.length > 0 && (
    <div className="qd-sigs" data-cols={tpl.signatureColumns}>
      {visibleSignatures.map((slot) => (
        <SignatureSlot key={slot.id} role={slot.role} block={signatureBlockFor(slot)} />
      ))}
    </div>
  )

  /** A titled text block (notes, terms, client-defined sections). */
  const textBlock = (section: SectionConfig, body: string) =>
    body ? (
      <div className="qd-block">
        {section.title && <div className="qd-label">{section.title}</div>}
        <p>{body}</p>
      </div>
    ) : null

  const renderSection = (section: SectionConfig): ReactNode => {
    if (!section.visible) return null
    switch (section.kind) {
      case 'parties':
        return partiesBlock
      case 'items':
        return itemsBlock
      case 'totals':
        return totalsBlock
      case 'notes':
        return textBlock(section, doc.notes?.trim() ?? '')
      case 'terms':
        return textBlock(section, tpl.termsText)
      case 'custom':
        return textBlock(section, section.body)
      case 'signatures':
        // Nothing to draw when every slot is off and there's no note — skip the
        // block entirely so it doesn't leave a gap in the flow.
        if (!signaturesBlock && !tpl.signatureNote) return null
        return (
          <>
            {signaturesBlock}
            {tpl.signatureNote && <div className="qd-sigs__note">{tpl.signatureNote}</div>}
          </>
        )
      default:
        return null
    }
  }

  const watermarkText = tpl.watermark.useStatus ? status.label : tpl.watermark.text

  return (
    <div
      className="pdf-page"
      data-paper={tpl.paperSize}
      data-orientation={tpl.orientation}
      data-density={tpl.density}
      data-font={tpl.fontFamily}
      data-logo={tpl.logoSize}
      data-logo-pos={tpl.logoPosition}
      data-header={tpl.headerStyle}
      data-border={tpl.table.borderStyle}
      data-zebra={tpl.table.zebra ? 'on' : undefined}
      data-accent-header={tpl.table.accentHeader ? 'on' : undefined}
      data-upper-head={tpl.table.uppercaseHeader ? 'on' : undefined}
      data-upper-labels={tpl.uppercaseLabels ? 'on' : undefined}
      data-page-border={tpl.pageBorder ? 'on' : undefined}
      data-accent-total={tpl.totals.accentGrandTotal ? 'on' : undefined}
      style={
        {
          '--qd-accent': tpl.accentColor || '#4f46e5',
          '--qd-text': tpl.textColor || '#1f2937',
          '--qd-muted': tpl.mutedColor || '#6b7280',
          '--qd-page-w': `${pageWidth}px`,
          '--qd-page-h': `${pageHeight}px`,
          '--qd-pad-t': `${tpl.margin.top}px`,
          '--qd-pad-r': `${tpl.margin.right}px`,
          '--qd-pad-b': `${tpl.margin.bottom}px`,
          '--qd-pad-l': `${tpl.margin.left}px`,
          '--qd-fs': `${tpl.baseFontSize}px`,
          '--qd-totals-w': `${tpl.totals.width}px`,
        } as CSSProperties
      }
    >
      <div className="pdf-page__inner">
        {tpl.watermark.enabled && watermarkText && (
          <div
            className="qd-watermark"
            style={{
              opacity: tpl.watermark.opacity,
              transform: `translate(-50%, -50%) rotate(${tpl.watermark.angle}deg)`,
            }}
          >
            {watermarkText}
          </div>
        )}

        <header className="qd-head">
          {brand}
          {title}
        </header>

        {tpl.showHeaderRule && <div className="qd-rule" />}

        <div className="qd-body">
          {tpl.sections.map((section) => {
            const content = renderSection(section)
            return content ? (
              <div className={`qd-section qd-section--${section.kind}`} key={section.id}>
                {content}
              </div>
            ) : null
          })}
        </div>

        {/* Footer band, pinned to the bottom of the page */}
        <footer className="qd-foot" data-divider={tpl.footerDivider ? 'on' : undefined}>
          <span className="qd-foot__note">{tpl.footerText || company?.legalName || companyName}</span>
          <span className="qd-foot__meta">
            {[
              tpl.showPageNumber && 'Page 1 of 1',
              tpl.showGeneratedBy && `${doc.reference} · Generated by Venturo`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </footer>
      </div>
    </div>
  )
}

export default QuotationDocument
