import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton, Tag } from 'antd'
import { ArrowLeft, Truck, MapPin, ShoppingCart, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetVendorsQuery } from '../contactsApi'
import { useGetPurchasesQuery } from '../../inventory/inventoryApi'
import type { Vendor } from '../types'
import '../../../shared/styles/detail.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const addressOf = (v: Vendor) =>
  [v.addressLine1, v.addressLine2, v.city, v.state, v.postalCode, v.country]
    .filter(Boolean)
    .join(', ')

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
  const address = addressOf(vendor)
  const active = vendor.status === 'active'

  const story =
    `${vendor.company} is ${active ? 'an active' : 'an inactive'} ${vendor.category ? `${vendor.category.toLowerCase()} ` : ''}vendor` +
    (vendor.city ? ` based in ${[vendor.city, vendor.country].filter(Boolean).join(', ')}` : '') +
    `. ` +
    (orders.length
      ? `You've placed ${orders.length} purchase${orders.length > 1 ? 's' : ''} with them totaling ${peso(totalSpend)}` +
        (lastOrder ? `, most recently on ${dayjs(lastOrder).format('MMM D, YYYY')}.` : '.')
      : `No purchases have been recorded with them yet.`)

  return (
    <div className="module-view">
      <Link to="/purchases/vendors" className="idp__back">
        <ArrowLeft size={16} /> Back to vendors
      </Link>

      <article className="idp">
        <header className="idp__hero idp__hero--vendor">
          <div className="idp__avatar">{(vendor.company[0] ?? '?').toUpperCase()}</div>
          <div className="idp__kicker">Vendor{vendor.category ? ` · ${vendor.category}` : ''}</div>
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
          <Stat label="Category" value={vendor.category || '—'} />
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
