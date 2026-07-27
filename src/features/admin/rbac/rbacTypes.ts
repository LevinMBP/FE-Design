import type { ModuleId } from '../../modules/modules'

/** Tenant root. New RBAC entities are scoped to an organization. */
export interface Organization {
  id: string
  name: string
  code: string
  status: 'active' | 'inactive'
}

/** A named role that grants module access. `isSystemAdmin` = full access + admin area. */
export interface AppRole {
  id: string
  organizationId: string
  name: string
  description: string
  isSystemAdmin: boolean
}

/** A job position that (like a role) grants module access to whoever holds it. */
export interface Position {
  id: string
  organizationId: string
  name: string
  description: string
}

/** A direct per-user override on a single module; `deny` beats every grant. */
export type ModulePermissionEffect = 'allow' | 'deny'
export interface UserPermission {
  moduleId: ModuleId
  effect: ModulePermissionEffect
}

/** The full RBAC dataset (everything except per-user assignments, which live on the user). */
export interface RbacTables {
  organizations: Organization[]
  roles: AppRole[]
  positions: Position[]
  /** roleId → granted module ids (RolePermission). */
  rolePermissions: Record<string, ModuleId[]>
  /** positionId → granted module ids (PositionPermission). */
  positionPermissions: Record<string, ModuleId[]>
}
