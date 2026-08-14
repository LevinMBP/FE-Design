import type { UserPermission } from '../admin/rbac/rbacTypes'

export type UserStatus = 'active' | 'inactive'

/** A user as exposed to the app (never includes the password). */
export interface User {
  id: string
  name: string
  email: string
  organizationId: string
  /** Roles held (UserRole). Effective access unions their module grants. */
  roleIds: string[]
  /** Assigned position (its module grants also apply). */
  positionId?: string
  /** Direct per-module overrides; deny beats every grant. */
  userPermissions: UserPermission[]
  status: UserStatus
}

/** What we persist for a logged-in session. */
export interface Session {
  user: User
  token: string
  /** epoch ms after which the session is considered expired */
  expiresAt: number
}

export interface LoginRequest {
  email: string
  password: string
  remember: boolean
}

/**
 * Outcome of redeeming an email-confirmation token. Every case is a normal
 * result rather than an error — the confirmation page renders a distinct
 * screen for each one, and only a transport failure is a true error.
 */
export type VerifyEmailResult =
  | { status: 'verified'; email: string }
  | { status: 'already-verified'; email: string }
  | { status: 'expired'; email: string }
  | { status: 'invalid' }

export interface ResendVerificationResult {
  email: string
  /** Fresh token — real backends mail this; the demo surfaces the link. */
  token: string
}
