import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton, Tag } from 'antd'
import { ArrowLeft, User, MapPin, Receipt, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetCustomersQuery } from '../contactsApi'
import { useGetSalesQuery } from '../../inventory/inventoryApi'
import type { Customer } from '../types'
import '../../../shared/styles/detail.css'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

const addressOf = (c: Customer) =>
  [c.addressLine1, c.addressLine2, c.city, c.state, c.postalCode, c.country]
    .filter(Boolean)
    .join(', ')

function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: customers, isLoading } = useGetCustomersQuery()
  const { data: sales } = useGetSalesQuery()

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }
  const customer = customers?.find((c) => c.id === id)
  if (!customer) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Not found</h1>
            <p>We couldn't find that customer.</p>
          </div>
        </div>
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/sales/customers')}>
          Back
        </Button>
      </div>
    )
  }

  const orders = (sales ?? []).filter((s) => s.customerId === id)
  const totalSales = orders.reduce((sum, s) => sum + s.total, 0)
  const lastOrder = orders
    .map((s) => s.date)
    .sort()
    .at(-1)
  const address = addressOf(customer)
  const active = customer.status === 'active'

  const story =
    `${customer.company} is ${active ? 'an active' : 'an inactive'} customer` +
    (customer.city ? ` based in ${[customer.city, customer.country].filter(Boolean).join(', ')}` : '') +
    `. ` +
    (orders.length
      ? `They've placed ${orders.length} order${orders.length > 1 ? 's' : ''} totaling ${peso(totalSales)}` +
        (lastOrder ? `, most recently on ${dayjs(lastOrder).format('MMM D, YYYY')}.` : '.')
      : `No sales have been recorded for them yet.`)

  return (
    <div className="module-view">
      <Link to="/sales/customers" className="idp__back">
        <ArrowLeft size={16} /> Back to customers
      </Link>

      <article className="idp">
        <header className="idp__hero idp__hero--customer">
          <div className="idp__avatar">{(customer.company[0] ?? '?').toUpperCase()}</div>
          <div className="idp__kicker">Customer</div>
          <h1 className="idp__title">{customer.company}</h1>
          <div className="idp__meta">
            {customer.email && <span>{customer.email}</span>}
            {customer.contactNumber && (
              <>
                <span>·</span>
                <span>{customer.contactNumber}</span>
              </>
            )}
            <Tag color={active ? 'success' : 'default'} style={{ marginInlineStart: 6 }}>
              {active ? 'Active' : 'Inactive'}
            </Tag>
          </div>
        </header>

        <section className="idp__stats">
          <Stat label="Total sales" value={peso(totalSales)} />
          <Stat label="Orders" value={String(orders.length)} />
          <Stat
            label="Last order"
            value={lastOrder ? dayjs(lastOrder).format('MMM D, YYYY') : '—'}
          />
          <Stat label="Status" value={active ? 'Active' : 'Inactive'} />
        </section>

        <section className="idp__section">
          <h2><User size={17} /> Overview</h2>
          <p className="idp__story">{story}</p>
        </section>

        <section className="idp__section">
          <h2><MapPin size={17} /> Contact &amp; address</h2>
          <div className="idp__list">
            <InfoRow label="Contact person" value={customer.contactPerson} />
            <InfoRow label="Email" value={customer.email} />
            <InfoRow label="Phone" value={customer.contactNumber} />
            <InfoRow label="Address" value={address} />
          </div>
        </section>

        <section className="idp__section">
          <h2><Receipt size={17} /> Recent orders</h2>
          {orders.length === 0 ? (
            <p className="idp__hint">No sales orders yet.</p>
          ) : (
            <div className="idp__list">
              {[...orders]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 6)
                .map((s) => (
                  <div key={s.id} className="idp__list-row">
                    <span className="idp__list-main">{s.reference}</span>
                    <span className="idp__list-sub">{dayjs(s.date).format('MMM D, YYYY')}</span>
                    <span className="idp__list-amt">{peso(s.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        <div className="idp__actions">
          <Link to="/sales/orders/new">
            <Button type="primary" icon={<Plus size={16} />}>
              New sale
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

export default CustomerDetailPage
