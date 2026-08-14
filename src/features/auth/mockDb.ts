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
import type { User, UserStatus } from './types'

/** A seed user in the mock DB — includes the password, unlike the app-facing User. */
interface MockUser extends User {
  password: string
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
    role: 'admin',
    emailVerified: true,
  },
  {
    id: 'usr_2',
    name: 'Marcus Lee',
    email: 'manager@venturo.app',
    password: 'password123',
    role: 'manager',
  },
  {
    id: 'usr_3',
    name: 'Priya Nair',
    email: 'staff@venturo.app',
    password: 'password123',
    role: 'staff',
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

/** Patch a seed user and return the app-facing (password-free) User. */
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
