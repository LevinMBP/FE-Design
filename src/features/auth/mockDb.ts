import {
  SEED_ORG_ID,
  SEED_POS_CLERK,
  SEED_POS_DIRECTOR,
  SEED_POS_WH_MANAGER,
  SEED_ROLE_ADMIN,
  SEED_ROLE_MANAGER,
  SEED_ROLE_STAFF,
} from '../admin/rbac/mockRbac'
import type { UserPermission } from '../admin/rbac/rbacTypes'
import type { User, UserStatus, VerifyEmailResult } from './types'

/** A seed user in the mock DB — includes the password, unlike the app-facing User. */
interface MockUser extends User {
  password: string
  /** Flipped by redeeming a confirmation token; see `redeemVerificationToken`. */
  emailVerified: boolean
}

/**
 * Mock "database" of users. Replace the auth endpoints' queryFns with real HTTP
 * calls later — the `User` shape and the RTK Query hooks are the app's contract.
 */
export const users: MockUser[] = [
  {
    id: 'usr_1',
    name: 'Ava Reyes',
    email: 'admin@venturo.app',
    password: 'password123',
    organizationId: SEED_ORG_ID,
    roleIds: [SEED_ROLE_ADMIN],
    positionId: SEED_POS_DIRECTOR,
    userPermissions: [],
    status: 'active',
    emailVerified: true,
  },
  {
    id: 'usr_2',
    name: 'Marcus Lee',
    email: 'manager@venturo.app',
    password: 'password123',
    organizationId: SEED_ORG_ID,
    roleIds: [SEED_ROLE_MANAGER],
    positionId: SEED_POS_WH_MANAGER,
    userPermissions: [],
    status: 'active',
    emailVerified: false,
  },
  {
    id: 'usr_3',
    name: 'Priya Nair',
    email: 'staff@venturo.app',
    password: 'password123',
    organizationId: SEED_ORG_ID,
    roleIds: [SEED_ROLE_STAFF],
    positionId: SEED_POS_CLERK,
    userPermissions: [],
    status: 'active',
    emailVerified: false,
  },
]

/** Project a mock user down to the app-facing (password-free) User. */
function toUser(u: MockUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    organizationId: u.organizationId,
    roleIds: [...u.roleIds],
    positionId: u.positionId,
    userPermissions: [...u.userPermissions],
    status: u.status,
  }
}

export function findUserByEmail(email: string): MockUser | undefined {
  const normalized = email.trim().toLowerCase()
  return users.find((u) => u.email.toLowerCase() === normalized)
}

export function listUsers(): User[] {
  return users.map(toUser)
}

/** Patch a seed user and return the app-facing User. */
export function updateUser(
  id: string,
  patch: Partial<Pick<MockUser, 'name'>>,
): User | undefined {
  const found = users.find((u) => u.id === id)
  if (!found) return undefined
  Object.assign(found, patch)
  return toUser(found)
}

export interface NewUser {
  name: string
  email: string
  password: string
  roleIds: string[]
  positionId?: string
}

const uid = () => `usr_${crypto.randomUUID().slice(0, 8)}`

/** Invite/add a user. Throws on a duplicate email. */
export function addUser(input: NewUser): User {
  const email = input.email.trim()
  if (findUserByEmail(email)) {
    throw new Error('A user with that email already exists.')
  }
  const record: MockUser = {
    id: uid(),
    name: input.name.trim(),
    email,
    password: input.password,
    organizationId: SEED_ORG_ID,
    roleIds: input.roleIds,
    positionId: input.positionId,
    userPermissions: [],
    status: 'active',
    // An invited user confirms via the link mailed to them.
    emailVerified: false,
  }
  users.push(record)
  return toUser(record)
}

export function setUserRoles(id: string, roleIds: string[]): User | undefined {
  const found = users.find((u) => u.id === id)
  if (!found) return undefined
  found.roleIds = roleIds
  return toUser(found)
}

export function setUserPosition(id: string, positionId: string | undefined): User | undefined {
  const found = users.find((u) => u.id === id)
  if (!found) return undefined
  found.positionId = positionId
  return toUser(found)
}

export function setUserPermissions(id: string, userPermissions: UserPermission[]): User | undefined {
  const found = users.find((u) => u.id === id)
  if (!found) return undefined
  found.userPermissions = userPermissions
  return toUser(found)
}

export function setUserStatus(id: string, status: UserStatus): User | undefined {
  const found = users.find((u) => u.id === id)
  if (!found) return undefined
  found.status = status
  return toUser(found)
}

/* ============ Email confirmation tokens ============ */

interface VerificationToken {
  token: string
  userId: string
  /** epoch ms after which the token can no longer be redeemed */
  expiresAt: number
  /** epoch ms when it was redeemed, or null while still unused */
  usedAt: number | null
}

const HOUR_MS = 60 * 60 * 1000

/**
 * Seed tokens so every branch of the confirmation page can be walked without a
 * backend. Hit /verify-email?token=<one of these> to see each state:
 *   demo-valid-token    → success
 *   demo-expired-token  → expired, with a resend option
 *   demo-used-token     → already confirmed
 *   anything else       → invalid link
 */
export const verificationTokens: VerificationToken[] = [
  {
    token: 'demo-valid-token',
    userId: 'usr_2',
    expiresAt: Date.now() + 24 * HOUR_MS,
    usedAt: null,
  },
  {
    token: 'demo-expired-token',
    userId: 'usr_3',
    expiresAt: Date.now() - HOUR_MS,
    usedAt: null,
  },
  {
    token: 'demo-used-token',
    userId: 'usr_1',
    expiresAt: Date.now() + 24 * HOUR_MS,
    usedAt: Date.now() - 2 * HOUR_MS,
  },
]

/**
 * Redeem a confirmation token. Marks the token used and flips the user's
 * `emailVerified` flag on success; every other outcome leaves the DB untouched.
 */
export function redeemVerificationToken(token: string): VerifyEmailResult {
  const record = verificationTokens.find((t) => t.token === token.trim())
  if (!record) return { status: 'invalid' }

  const user = users.find((u) => u.id === record.userId)
  if (!user) return { status: 'invalid' }

  if (record.usedAt !== null || user.emailVerified) {
    return { status: 'already-verified', email: user.email }
  }
  if (record.expiresAt < Date.now()) {
    return { status: 'expired', email: user.email }
  }

  record.usedAt = Date.now()
  user.emailVerified = true
  return { status: 'verified', email: user.email }
}

/**
 * Issue a replacement token for whoever the (expired) token belonged to.
 * Returns undefined when the original token isn't one we know about.
 */
export function issueVerificationToken(
  previousToken: string,
): { email: string; token: string } | undefined {
  const record = verificationTokens.find((t) => t.token === previousToken.trim())
  if (!record) return undefined

  const user = users.find((u) => u.id === record.userId)
  if (!user) return undefined

  const token = crypto.randomUUID()
  verificationTokens.push({
    token,
    userId: user.id,
    expiresAt: Date.now() + 24 * HOUR_MS,
    usedAt: null,
  })
  return { email: user.email, token }
}
