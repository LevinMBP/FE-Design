import type { ReactNode } from 'react'
import { formatPeso, type ReportGroup } from '../types'

/** Shared building blocks for the Balance Sheet and Income Statement layouts. */

export function Statement({ children }: { children: ReactNode }) {
  return (
    <div
      className="form-shell"
      style={{ maxWidth: 560, padding: '8px 20px 16px' }}
    >
      {children}
    </div>
  )
}

export function Row({
  label,
  amount,
  strong,
  muted,
  top,
}: {
  label: ReactNode
  amount: number
  strong?: boolean
  muted?: boolean
  top?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '7px 0',
        fontWeight: strong ? 700 : 400,
        color: muted ? 'var(--text-muted)' : 'var(--text)',
        borderTop: top ? '1px solid var(--border)' : undefined,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>{label}</span>
      <span>{formatPeso(amount)}</span>
    </div>
  )
}

export function GroupBlock({ group }: { group: ReportGroup }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-subtle)',
          margin: '6px 0 2px',
        }}
      >
        {group.label}
      </div>
      {group.lines.map((l) => (
        <Row key={l.code} label={`${l.code} · ${l.name}`} amount={l.amount} muted />
      ))}
      <Row label={`Total ${group.label}`} amount={group.total} strong top />
    </div>
  )
}
