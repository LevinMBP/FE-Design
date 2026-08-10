/**
 * Soft delete primitives shared by every entity.
 *
 * Deleting an entity never removes the row — it stamps `deletedAt`. Lists take a
 * `ListScope` so the same endpoint can serve the normal view, the recovery view,
 * and an everything view; `active` is the default everywhere so a caller that
 * forgets to pass a scope still gets the safe answer.
 *
 * Note that this is deliberately separate from an entity's own `status`
 * ('active' | 'inactive'). Inactive is a business state the user chose; deleted
 * is a record that has been removed and can be restored.
 */

export type ListScope = 'active' | 'deleted' | 'all'

export interface SoftDeletable {
  /** ISO timestamp of the delete, or null/undefined when the record is live. */
  deletedAt?: string | null
  /** Display name of whoever deleted it, for the recovery view. */
  deletedBy?: string | null
}

export const isDeleted = (record: SoftDeletable): boolean => Boolean(record.deletedAt)

/** Filter a list to a scope. The mock stores call this; the real API will do it server-side. */
export function applyScope<T extends SoftDeletable>(rows: T[], scope: ListScope): T[] {
  if (scope === 'all') return [...rows]
  return rows.filter((row) => (scope === 'deleted' ? isDeleted(row) : !isDeleted(row)))
}

export function markDeleted<T extends SoftDeletable>(record: T, actor: string): T {
  return { ...record, deletedAt: new Date().toISOString(), deletedBy: actor }
}

export function markRestored<T extends SoftDeletable>(record: T): T {
  return { ...record, deletedAt: null, deletedBy: null }
}
