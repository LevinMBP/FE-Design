export type Role = 'admin' | 'manager' | 'staff'

/** A user as exposed to the app (never includes the password). */
export interface User {
  id: string
  name: string
  email: string
  role: Role
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
