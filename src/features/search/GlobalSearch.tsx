import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from 'antd'
import {
  Search,
  Package,
  Boxes,
  Warehouse,
  Users,
  Truck,
  UserCog,
  Receipt,
  CreditCard,
  ShoppingCart,
  Tags,
  Calculator,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react'
import {
  useGetLocationsQuery,
  useGetMaterialsQuery,
  useGetProductsQuery,
  useGetPurchasesQuery,
  useGetSalesQuery,
} from '../inventory/inventoryApi'
import {
  useGetCustomersQuery,
  useGetEmployeesQuery,
  useGetVendorsQuery,
} from '../contacts/contactsApi'
import {
  useGetPaymentMethodsQuery,
  useGetTaxesQuery,
} from '../finance/financeApi'
import { useGetAccountsQuery } from '../accounting/accountingApi'
import './GlobalSearch.css'

interface Hit {
  key: string
  group: string
  label: string
  sub: string
  to: string
}

const GROUP_ICON: Record<string, LucideIcon> = {
  Products: Package,
  Materials: Boxes,
  Locations: Warehouse,
  Customers: Users,
  Vendors: Truck,
  Employees: UserCog,
  Taxes: Receipt,
  'Payment Methods': CreditCard,
  Purchases: ShoppingCart,
  Sales: Tags,
  Accounts: Calculator,
}

const PER_GROUP = 6
const MAX = 24
const clean = (s: string) => s.toLowerCase().trim()

/**
 * Spotlight-style global search. ⌘K / Ctrl-K (or clicking the topbar box) opens
 * a centered palette that searches every record it can find — master data and
 * documents — and jumps to the record on Enter/click.
 */
function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl-K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Only load the lists once the palette has been opened.
  const skip = { skip: !open }
  const { data: products } = useGetProductsQuery(undefined, skip)
  const { data: materials } = useGetMaterialsQuery(undefined, skip)
  const { data: locations } = useGetLocationsQuery(undefined, skip)
  const { data: purchases } = useGetPurchasesQuery(undefined, skip)
  const { data: sales } = useGetSalesQuery(undefined, skip)
  const { data: customers } = useGetCustomersQuery(undefined, skip)
  const { data: vendors } = useGetVendorsQuery(undefined, skip)
  const { data: employees } = useGetEmployeesQuery(undefined, skip)
  const { data: taxes } = useGetTaxesQuery(undefined, skip)
  const { data: paymentMethods } = useGetPaymentMethodsQuery(undefined, skip)
  const { data: accounts } = useGetAccountsQuery(undefined, skip)

  const index = useMemo<Hit[]>(() => {
    const hits: Hit[] = []
    for (const p of products ?? [])
      hits.push({ key: `prd:${p.id}`, group: 'Products', label: p.name, sub: p.sku, to: `/inventory/products/${p.id}` })
    for (const m of materials ?? [])
      hits.push({ key: `mat:${m.id}`, group: 'Materials', label: m.name, sub: m.sku, to: `/inventory/materials/${m.id}` })
    for (const l of locations ?? [])
      hits.push({ key: `loc:${l.id}`, group: 'Locations', label: l.name, sub: l.code, to: `/inventory/locations/${l.id}` })
    for (const c of customers ?? [])
      hits.push({ key: `cus:${c.id}`, group: 'Customers', label: c.company, sub: c.email, to: `/sales/customers/${c.id}` })
    for (const v of vendors ?? [])
      hits.push({ key: `ven:${v.id}`, group: 'Vendors', label: v.company, sub: v.email, to: `/purchases/vendors/${v.id}` })
    for (const e of employees ?? [])
      hits.push({ key: `emp:${e.id}`, group: 'Employees', label: e.name, sub: e.position, to: '/finance/employees' })
    for (const t of taxes ?? [])
      hits.push({ key: `tax:${t.id}`, group: 'Taxes', label: t.name, sub: `${t.rate}%`, to: '/finance/taxes' })
    for (const pm of paymentMethods ?? [])
      hits.push({ key: `pm:${pm.id}`, group: 'Payment Methods', label: pm.name, sub: pm.provider, to: '/finance/payment-methods' })
    for (const pu of purchases ?? [])
      hits.push({ key: `pur:${pu.id}`, group: 'Purchases', label: pu.reference, sub: pu.vendorName, to: '/purchases/orders' })
    for (const s of sales ?? [])
      hits.push({ key: `sal:${s.id}`, group: 'Sales', label: s.reference, sub: s.customerName, to: '/sales/orders' })
    for (const a of accounts ?? [])
      hits.push({ key: `acc:${a.id}`, group: 'Accounts', label: `${a.code} · ${a.name}`, sub: a.type, to: '/accounting/accounts' })
    return hits
  }, [products, materials, locations, customers, vendors, employees, taxes, paymentMethods, purchases, sales, accounts])

  // Flat (for keyboard nav) + grouped (for display), sharing the same order.
  const { flat, groups } = useMemo(() => {
    const q = clean(text)
    if (!q) return { flat: [] as Hit[], groups: [] as { group: string; hits: Hit[] }[] }

    const matched = index.filter(
      (h) => clean(h.label).includes(q) || clean(h.sub).includes(q),
    )
    const byGroup = new Map<string, Hit[]>()
    let total = 0
    for (const h of matched) {
      if (total >= MAX) break
      const list = byGroup.get(h.group) ?? []
      if (list.length < PER_GROUP) {
        list.push(h)
        byGroup.set(h.group, list)
        total++
      }
    }
    const groups = [...byGroup.entries()].map(([group, hits]) => ({ group, hits }))
    const flat = groups.flatMap((g) => g.hits)
    return { flat, groups }
  }, [text, index])

  useEffect(() => setActiveIdx(0), [text])

  const close = () => {
    setOpen(false)
    setText('')
    setActiveIdx(0)
  }

  const go = (hit: Hit | undefined) => {
    if (!hit) return
    navigate(hit.to)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(flat[activeIdx])
    }
  }

  return (
    <>
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
      >
        <Search size={16} />
        <span className="global-search-trigger__text">Search…</span>
        <kbd className="global-search-trigger__kbd">⌘K</kbd>
      </button>

      <Modal
        open={open}
        onCancel={close}
        footer={null}
        closable={false}
        width={640}
        style={{ top: 88 }}
        styles={{ body: { padding: 0 } }}
        className="global-search-modal"
        afterOpenChange={(o) => o && inputRef.current?.focus()}
        destroyOnHidden
      >
        <div className="gsp">
          <div className="gsp__input">
            <Search size={18} />
            <input
              ref={inputRef}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search products, materials, contacts, documents…"
            />
            <kbd className="gsp__esc">esc</kbd>
          </div>

          <div className="gsp__body">
            {!text && (
              <div className="gsp__empty">
                Start typing to search across{' '}
                <strong>products, materials, locations, contacts, documents</strong>{' '}
                and <strong>accounts</strong>.
              </div>
            )}

            {text && flat.length === 0 && (
              <div className="gsp__empty">
                No matches for “<strong>{text}</strong>”.
              </div>
            )}

            {groups.map(({ group, hits }) => {
              const Icon = GROUP_ICON[group] ?? Search
              return (
                <div key={group} className="gsp__group">
                  <div className="gsp__group-label">{group}</div>
                  {hits.map((h) => {
                    const idx = flat.indexOf(h)
                    return (
                      <button
                        key={h.key}
                        type="button"
                        className={`gsp__row ${idx === activeIdx ? 'is-active' : ''}`}
                        onMouseMove={() => setActiveIdx(idx)}
                        onClick={() => go(h)}
                      >
                        <span className="gsp__row-icon">
                          <Icon size={16} />
                        </span>
                        <span className="gsp__row-label">{h.label}</span>
                        {h.sub && <span className="gsp__row-sub">{h.sub}</span>}
                        {idx === activeIdx && (
                          <CornerDownLeft size={14} className="gsp__row-enter" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className="gsp__foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default GlobalSearch
