import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../../app/store'
import type { ModuleId } from '../../modules/modules'
import { loadRbac, saveRbac } from './mockRbac'
import type { AppRole, Organization, Position, RbacTables } from './rbacTypes'

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

const initialState: RbacTables = loadRbac()

function toggle(list: ModuleId[] | undefined, moduleId: ModuleId): ModuleId[] {
  const current = list ?? []
  return current.includes(moduleId)
    ? current.filter((id) => id !== moduleId)
    : [...current, moduleId]
}

const rbacSlice = createSlice({
  name: 'rbac',
  initialState,
  reducers: {
    addOrganization: {
      reducer(state, action: PayloadAction<Organization>) {
        state.organizations.push(action.payload)
        saveRbac(state)
      },
      prepare(input: Omit<Organization, 'id'>) {
        return { payload: { ...input, id: uid('org') } }
      },
    },
    addRole: {
      reducer(state, action: PayloadAction<AppRole>) {
        state.roles.push(action.payload)
        state.rolePermissions[action.payload.id] = []
        saveRbac(state)
      },
      prepare(input: Omit<AppRole, 'id'>) {
        return { payload: { ...input, id: uid('role') } }
      },
    },
    setRoleAdmin(state, action: PayloadAction<{ roleId: string; isSystemAdmin: boolean }>) {
      const role = state.roles.find((r) => r.id === action.payload.roleId)
      if (role) role.isSystemAdmin = action.payload.isSystemAdmin
      saveRbac(state)
    },
    toggleRoleModule(state, action: PayloadAction<{ roleId: string; moduleId: ModuleId }>) {
      const { roleId, moduleId } = action.payload
      state.rolePermissions[roleId] = toggle(state.rolePermissions[roleId], moduleId)
      saveRbac(state)
    },
    addPosition: {
      reducer(state, action: PayloadAction<Position>) {
        state.positions.push(action.payload)
        state.positionPermissions[action.payload.id] = []
        saveRbac(state)
      },
      prepare(input: Omit<Position, 'id'>) {
        return { payload: { ...input, id: uid('pos') } }
      },
    },
    togglePositionModule(state, action: PayloadAction<{ positionId: string; moduleId: ModuleId }>) {
      const { positionId, moduleId } = action.payload
      state.positionPermissions[positionId] = toggle(state.positionPermissions[positionId], moduleId)
      saveRbac(state)
    },
  },
})

export const {
  addOrganization,
  addRole,
  setRoleAdmin,
  toggleRoleModule,
  addPosition,
  togglePositionModule,
} = rbacSlice.actions

/**
 * The whole RBAC table set, a stable reference until an action changes it.
 * Components derive user-specific values with `useMemo` + the pure resolvers in
 * `mockRbac.ts` (do NOT wrap those in curried selectors — returning a fresh
 * array from a selector every render triggers an infinite re-render loop).
 */
export const selectRbac = (state: RootState) => state.rbac

export default rbacSlice.reducer
