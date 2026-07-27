import { MODULES, type ModuleId } from '../../modules/modules'
import type { User } from '../../auth/types'
import type { RbacTables } from './rbacTypes'

const STORAGE_KEY = 'venturo.rbac'
const ALL_MODULE_IDS = MODULES.map((m) => m.id)

// Stable seed ids so seeded users (mockDb) can reference roles/positions.
export const SEED_ORG_ID = 'org_1'
export const SEED_ROLE_ADMIN = 'role_admin'
export const SEED_ROLE_MANAGER = 'role_manager'
export const SEED_ROLE_STAFF = 'role_staff'
export const SEED_POS_DIRECTOR = 'pos_director'
export const SEED_POS_WH_MANAGER = 'pos_wh_manager'
export const SEED_POS_CLERK = 'pos_clerk'

function seed(): RbacTables {
  return {
    organizations: [
      { id: SEED_ORG_ID, name: 'Venturo Inc.', code: 'VNT', status: 'active' },
    ],
    roles: [
      {
        id: SEED_ROLE_ADMIN,
        organizationId: SEED_ORG_ID,
        name: 'Administrator',
        description: 'Full access to every module and the admin area.',
        isSystemAdmin: true,
      },
      {
        id: SEED_ROLE_MANAGER,
        organizationId: SEED_ORG_ID,
        name: 'Manager',
        description: 'Runs day-to-day operations across all business modules.',
        isSystemAdmin: false,
      },
      {
        id: SEED_ROLE_STAFF,
        organizationId: SEED_ORG_ID,
        name: 'Staff',
        description: 'Front-line access to core inventory and order modules.',
        isSystemAdmin: false,
      },
    ],
    positions: [
      { id: SEED_POS_DIRECTOR, organizationId: SEED_ORG_ID, name: 'Operations Director', description: 'Oversees the whole operation.' },
      { id: SEED_POS_WH_MANAGER, organizationId: SEED_ORG_ID, name: 'Warehouse Manager', description: 'Manages stock and fulfilment.' },
      { id: SEED_POS_CLERK, organizationId: SEED_ORG_ID, name: 'Inventory Clerk', description: 'Records stock movements.' },
    ],
    rolePermissions: {
      // admin's grants are irrelevant (isSystemAdmin short-circuits) but seed all for display.
      [SEED_ROLE_ADMIN]: [...ALL_MODULE_IDS],
      [SEED_ROLE_MANAGER]: [...ALL_MODULE_IDS],
      [SEED_ROLE_STAFF]: ['inventory', 'sales', 'purchases'],
    },
    positionPermissions: {
      [SEED_POS_DIRECTOR]: [...ALL_MODULE_IDS],
      [SEED_POS_WH_MANAGER]: ['inventory', 'purchases'],
      [SEED_POS_CLERK]: ['inventory'],
    },
  }
}

export function loadRbac(): RbacTables {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RbacTables>
      const base = seed()
      return {
        organizations: parsed.organizations ?? base.organizations,
        roles: parsed.roles ?? base.roles,
        positions: parsed.positions ?? base.positions,
        rolePermissions: parsed.rolePermissions ?? base.rolePermissions,
        positionPermissions: parsed.positionPermissions ?? base.positionPermissions,
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seed()
}

export function saveRbac(tables: RbacTables): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
  } catch {
    /* storage unavailable — in-memory only */
  }
}

/* ------------------------------------------------------------------ *
 * Pure resolvers — used by React selectors AND non-React callers      *
 * (login, audit log) that only have the persisted tables + a user.    *
 * ------------------------------------------------------------------ */

/** Roles the user holds. (Defensive against sessions predating the RBAC fields.) */
function rolesOf(tables: RbacTables, user: Pick<User, 'roleIds'>) {
  const roleIds = user.roleIds ?? []
  return tables.roles.filter((r) => roleIds.includes(r.id))
}

export function isAdminUser(tables: RbacTables, user: Pick<User, 'roleIds'>): boolean {
  return rolesOf(tables, user).some((r) => r.isSystemAdmin)
}

export function roleNamesForUser(tables: RbacTables, user: Pick<User, 'roleIds'>): string[] {
  return rolesOf(tables, user).map((r) => r.name)
}

/**
 * Modules the user may open, combining the three access paths:
 * roles ∪ position ∪ user-allow, minus user-deny. A system-admin role → all modules.
 */
export function allowedModulesForUser(
  tables: RbacTables,
  user: Pick<User, 'roleIds' | 'positionId' | 'userPermissions'>,
): ModuleId[] {
  if (isAdminUser(tables, user)) return [...ALL_MODULE_IDS]

  const grant = new Set<ModuleId>()
  for (const roleId of user.roleIds ?? []) {
    for (const m of tables.rolePermissions[roleId] ?? []) grant.add(m)
  }
  if (user.positionId) {
    for (const m of tables.positionPermissions[user.positionId] ?? []) grant.add(m)
  }
  const overrides = user.userPermissions ?? []
  for (const p of overrides) {
    if (p.effect === 'allow') grant.add(p.moduleId)
  }
  for (const p of overrides) {
    if (p.effect === 'deny') grant.delete(p.moduleId)
  }
  return ALL_MODULE_IDS.filter((id) => grant.has(id))
}
