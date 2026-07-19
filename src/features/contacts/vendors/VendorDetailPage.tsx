import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton, Tag } from 'antd'
import { ArrowLeft, Truck, MapPin, ShoppingCart, Plus, Wallet } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetVendorsQuery } from '../contactsApi'
import { useGetPurchasesQuery } from '../../inventory/inventoryApi'
import { purchasePaymentStatus, type PaymentStatus } from '../../inventory/types'
import type { Vendor } from '../types'
import '../../../shared/styles/detail.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const addressOf = (v: Vendor) =>
  [v.addressLine1, v.addressLine2, v.city, v.state, v.postalCode, v.country]
    .filter(Boolean)
    .join(', ')

/** Whole days until the due date — negative when the bill is overdue. */
const daysLeft = (dueDate: string) =>
  dayjs(dueDate).startOf('day').diff(dayjs().startOf('day'), 'day')

/** Due-date urgency chip: overdue (error), due today/soon (warning), else quiet. */
function DueChip({ dueDate }: { dueDate: string }) {
  const d = daysLeft(dueDate)
  if (d < 0) return <Tag color="error" style={{ margin: 0 }}>{-d}d overdue</Tag>
  if (d === 0) return <Tag color="warning" style={{ margin: 0 }}>Due today</Tag>
  if (d <= 7) return <Tag color="warning" style={{ margin: 0 }}>{d}d left</Tag>
  return <Tag style={{ margin: 0 }}>{d}d left</Tag>
}

function VendorDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: vendors, isLoading } = useGetVendorsQuery()
  const { data: purchases } = useGetPurchasesQuery()

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }
  const vendor = vendors?.find((v) => v.id === id)
  if (!vendor) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Not found</h1>
            <p>We couldn't find that vendor.</p>
          </div>
        </div>
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/purchases/vendors')}>
          Back
        </Button>
      </div>
    )
  }

  const orders = (purchases ?? []).filter((p) => p.vendorId === id)
  const totalSpend = orders.reduce((sum, p) => sum + p.total, 0)
  const lastOrder = orders
    .map((p) => p.date)
    .sort()
    .at(-1)
  // Open bills: purchases not fully settled, oldest due date first.
  const openBills = orders
    .filter((p) => purchasePaymentStatus(p) !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const outstanding = openBills.reduce((sum, p) => sum + (p.netPayable - p.amountPaid), 0)
  const address = addressOf(vendor)
  const active = vendor.status === 'active'

  const story =
    `${vendor.company} is ${active ? 'an active' : 'an inactive'} vendor` +
    (vendor.city ? ` based in ${[vendor.city, vendor.country].filter(Boolean).join(', ')}` : '') +
    `. ` +
    (orders.length
      ? `You've placed ${orders.length} purchase${orders.length > 1 ? 's' : ''} with them totaling ${peso(totalSpend)}` +
        (lastOrder ? `, most recently on ${dayjs(lastOrder).format('MMM D, YYYY')}.` : '.') +
        (outstanding > 0.005
          ? ` ${peso(outstanding)} across ${openBills.length} bill${openBills.length > 1 ? 's' : ''} is still outstanding.`
          : ` All bills are fully settled.`)
      : `No purchases have been recorded with them yet.`)

  return (
    <div className="module-view">
      <Link to="/purchases/vendors" className="idp__back">
        <ArrowLeft size={16} /> Back to vendors
      </Link>

      <article className="idp">
        <header className="idp__hero idp__hero--vendor">
          <div className="idp__avatar">{(vendor.company[0] ?? '?').toUpperCase()}</div>
          <div className="idp__kicker">Vendor{vendor.city ? ` · ${[vendor.city, vendor.country].filter(Boolean).join(', ')}` : ''}</div>
          <h1 className="idp__title">{vendor.company}</h1>
          <div className="idp__meta">
            {vendor.email && <span>{vendor.email}</span>}
            {vendor.contactNumber && (
              <>
                <span>·</span>
                <span>{vendor.contactNumber}</span>
              </>
            )}
            <Tag color={active ? 'success' : 'default'} style={{ marginInlineStart: 6 }}>
              {active ? 'Active' : 'Inactive'}
            </Tag>
          </div>
        </header>

        <section className="idp__stats">
          <Stat label="Total spend" value={peso(totalSpend)} />
          <Stat label="Purchases" value={String(orders.length)} />
          <Stat
            label="Last order"
            value={lastOrder ? dayjs(lastOrder).format('MMM D, YYYY') : '—'}
          />
          <Stat label="Pending payables" value={peso(outstanding)} />
        </section>

        <section className="idp__section">
          <h2><Truck size={17} /> Overview</h2>
          <p className="idp__story">{story}</p>
        </section>

        <section className="idp__section">
          <h2><MapPin size={17} /> Contact &amp; address</h2>
          <div className="idp__list">
            <InfoRow label="Contact person" value={vendor.contactPerson} />
            <InfoRow label="Email" value={vendor.email} />
            <InfoRow label="Phone" value={vendor.contactNumber} />
            <InfoRow label="Address" value={address} />
          </div>
        </section>

        <section className="idp__section">
          <h2><Wallet size={17} /> Payables</h2>
          {openBills.length === 0 ? (
            <p className="idp__hint">
              {orders.length === 0
                ? 'No purchase orders yet.'
                : 'Nothing outstanding — every bill is paid.'}
            </p>
          ) : (
            <div className="idp__list">
              {openBills.map((p) => {
                const status: PaymentStatus = purchasePaymentStatus(p)
                const pending = p.netPayable - p.amountPaid
                return (
                  <div key={p.id} className="idp__list-row">
                    <span className="idp__list-main">
                      {p.reference}
                      {status === 'partial' && (
                        <Tag color="processing" style={{ marginInlineStart: 8 }}>
                          Partial
                        </Tag>
                      )}
                    </span>
                    <span className="idp__list-sub">
                      due {dayjs(p.dueDate).format('MMM D, YYYY')}
                    </span>
                    <span className="idp__list-sub" style={{ minWidth: 96 }}>
                      <DueChip dueDate={p.dueDate} />
                    </span>
                    <span className="idp__list-amt">
                      {peso(pending)}
                      {status === 'partial' && (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                          {' '}of {peso(p.netPayable)}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
              <div className="idp__list-row idp__list-row--total">
                <span className="idp__list-main">Total pending</span>
                <span className="idp__list-amt">{peso(outstanding)}</span>
              </div>
            </div>
          )}
          {openBills.length > 0 && (
            <p className="idp__hint" style={{ marginTop: 10 }}>
              Settle bills from <Link to="/purchases/orders">Purchase orders</Link> — each row
              has a Pay action.
            </p>
          )}
        </section>

        <section className="idp__section">
          <h2><ShoppingCart size={17} /> Recent purchases</h2>
          {orders.length === 0 ? (
            <p className="idp__hint">No purchase orders yet.</p>
          ) : (
            <div className="idp__list">
              {[...orders]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 6)
                .map((p) => (
                  <div key={p.id} className="idp__list-row">
                    <span className="idp__list-main">{p.reference}</span>
                    <span className="idp__list-sub">{dayjs(p.date).format('MMM D, YYYY')}</span>
                    <span className="idp__list-amt">{peso(p.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        <div className="idp__actions">
          <Link to="/purchases/orders/new">
            <Button type="primary" icon={<Plus size={16} />}>
              New purchase
            </Button>
          </Link>
        </div>
      </article>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="idp__stat">
      <div className="idp__stat-value">{value}</div>
      <div className="idp__stat-label">{label}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="idp__list-row">
      <span className="idp__list-main">{label}</span>
      <span className="idp__list-amt" style={{ minWidth: 0, fontWeight: 400 }}>
        {value || '—'}
      </span>
    </div>
  )
}

export default VendorDetailPage
