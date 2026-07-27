import type { Session, User } from './types'

const STORAGE_KEY = 'venturo.session'

/**
 * Persist the session. When `remember` is true we use localStorage (survives
 * browser restarts); otherwise sessionStorage (cleared when the tab closes).
 * We always clear the other store so there's exactly one source of truth.
 */
export function saveSession(session: Session, remember: boolean): void {
  const primary = remember ? window.localStorage : window.sessionStorage
  const secondary = remember ? window.sessionStorage : window.localStorage
  primary.setItem(STORAGE_KEY, JSON.stringify(session))
  secondary.removeItem(STORAGE_KEY)
}

/** Read the current session from either store, ignoring anything expired. */
export function loadSession(): Session | null {
  const raw =
    window.localStorage.getItem(STORAGE_KEY) ??
    window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    if (typeof session.expiresAt !== 'number' || session.expiresAt < Date.now()) {
      clearSession()
      return null
    }
    // Invalidate sessions saved before the RBAC user shape (no roleIds) so the
    // user re-logs in cleanly instead of landing with no access.
    if (!Array.isArray(session.user?.roleIds)) {
      clearSession()
      return null
    }
    return session
  } catch {
    clearSession()
    return null
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem(STORAGE_KEY)
}

/**
 * Patch the `user` on the persisted session in-place, writing back to whichever
 * store currently holds it so a profile edit survives a reload.
 */
export function updateStoredSessionUser(user: User): Session | null {
  const fromLocal = window.localStorage.getItem(STORAGE_KEY)
  const raw = fromLocal ?? window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const updated: Session = { ...(JSON.parse(raw) as Session), user }
    const store = fromLocal ? window.localStorage : window.sessionStorage
    store.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return null
  }
}
