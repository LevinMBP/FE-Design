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
