import { loadSession } from '../auth/session'
import { loadRbac, roleNamesForUser } from './rbac/mockRbac'

/**
 * Which part of the app an event came from. Business modules plus 'admin' and a
 * 'system' catch-all. Used for filtering the audit log.
 */
export type AuditModule =
  | 'inventory'
  | 'purchases'
  | 'sales'
  | 'finance'
  | 'accounting'
  | 'payroll'
  | 'admin'
  | 'system'

/** A single recorded action: who did what, when, to which target. */
export interface AuditEvent {
  id: string
  time: string // ISO timestamp
  actorId: string
  actorName: string
  actorRole: string // resolved role name(s), or '—'
  module: AuditModule
  action: string // human-readable, e.g. "Created purchase"
  target?: string // reference/name touched, e.g. "PO-1042"
  details?: string
}

const uid = () => `evt_${crypto.randomUUID().slice(0, 8)}`

// A little seeded history so the log isn't empty on first open. Real events
// (recorded during the session) are prepended ahead of these.
const seed = (
  hoursAgo: number,
  actorName: string,
  actorRole: string,
  module: AuditModule,
  action: string,
  target?: string,
): AuditEvent => ({
  id: uid(),
  time: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
  actorId: 'seed',
  actorName,
  actorRole,
  module,
  action,
  target,
})

let events: AuditEvent[] = [
  seed(3, 'Marcus Lee', 'Manager', 'purchases', 'Created purchase', 'PO-1042'),
  seed(6, 'Priya Nair', 'Staff', 'inventory', 'Manufactured product', 'MO-018'),
  seed(26, 'Ava Reyes', 'Administrator', 'accounting', 'Posted journal entry', 'JE-0007'),
  seed(50, 'Marcus Lee', 'Manager', 'sales', 'Created sale', 'SO-2231'),
]

export interface AuditInput {
  module: AuditModule
  action: string
  target?: string
  details?: string
}

/**
 * Record an event. The actor is resolved from the current session so callers
 * (mock mutation functions all over the app) don't have to thread the user
 * through — they just describe what happened.
 */
export function recordAuditEvent(input: AuditInput): void {
  const user = loadSession()?.user
  const roleNames = user ? roleNamesForUser(loadRbac(), user) : []
  events = [
    {
      id: uid(),
      time: new Date().toISOString(),
      actorId: user?.id ?? 'system',
      actorName: user?.name ?? 'System',
      actorRole: roleNames.length > 0 ? roleNames.join(', ') : '—',
      ...input,
    },
    ...events,
  ]
}

export function listAuditEvents(): AuditEvent[] {
  return [...events]
}
