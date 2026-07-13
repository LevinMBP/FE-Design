import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton, Tag } from 'antd'
import { ArrowLeft, Warehouse, Info, PackagePlus, Boxes } from 'lucide-react'
import { useGetLocationsQuery } from '../inventoryApi'
import { LOCATION_TYPE_LABELS } from '../types'
import '../../../shared/styles/detail.css'

function LocationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: locations, isLoading } = useGetLocationsQuery()

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    )
  }
  const location = locations?.find((l) => l.id === id)
  if (!location) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Not found</h1>
            <p>We couldn't find that location.</p>
          </div>
        </div>
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/inventory/locations')}>
          Back
        </Button>
      </div>
    )
  }

  const typeLabel = LOCATION_TYPE_LABELS[location.type]
  const active = location.status === 'active'
  const story =
    `${location.name} is a ${typeLabel.toLowerCase()} location` +
    (location.code ? ` coded ${location.code}` : '') +
    `. ` +
    (location.description
      ? location.description
      : `Stock can be received into and issued from here.`) +
    ` It's available to pick when posting opening balances.`

  return (
    <div className="module-view">
      <Link to="/inventory/locations" className="idp__back">
        <ArrowLeft size={16} /> Back to locations
      </Link>

      <article className="idp">
        <header className="idp__hero idp__hero--location">
          <div className="idp__avatar">{(location.name[0] ?? '?').toUpperCase()}</div>
          <div className="idp__kicker">Location · {typeLabel}</div>
          <h1 className="idp__title">{location.name}</h1>
          <div className="idp__meta">
            {location.code && <span className="idp__sku">{location.code}</span>}
            <Tag color={active ? 'success' : 'default'} style={{ marginInlineStart: 6 }}>
              {active ? 'Active' : 'Inactive'}
            </Tag>
          </div>
        </header>

        <section className="idp__section">
          <h2><Warehouse size={17} /> Overview</h2>
          <p className="idp__story">{story}</p>
        </section>

        <section className="idp__section">
          <h2><Info size={17} /> Details</h2>
          <div className="idp__list">
            <InfoRow label="Type" value={typeLabel} />
            <InfoRow label="Code" value={location.code} />
            <InfoRow label="Address" value={location.address} />
            <InfoRow label="Status" value={active ? 'Active' : 'Inactive'} />
            <InfoRow label="Description" value={location.description} />
          </div>
        </section>

        <section className="idp__section">
          <h2><Boxes size={17} /> Stock at this location</h2>
          <div className="idp__banner idp__banner--warn">
            Per-location stock levels aren't tracked yet — on-hand is currently pooled
            across all locations. This is on the roadmap.
          </div>
        </section>

        <div className="idp__actions">
          <Link to="/inventory/opening-balances">
            <Button type="primary" icon={<PackagePlus size={16} />}>
              Post opening balance
            </Button>
          </Link>
          <Link to="/inventory/stock">
            <Button icon={<Boxes size={16} />}>Stock overview</Button>
          </Link>
        </div>
      </article>
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

export default LocationDetailPage
