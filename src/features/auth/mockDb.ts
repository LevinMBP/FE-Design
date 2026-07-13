import type { User } from './types'

/** A seed user in the mock DB — includes the password, unlike the app-facing User. */
interface MockUser extends User {
  password: string
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
  return { id: found.id, name: found.name, email: found.email, role: found.role }
}
