import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  addUser,
  listUsers,
  setUserPermissions,
  setUserPosition,
  setUserRoles,
  setUserStatus,
  type NewUser,
} from '../auth/mockDb'
import { loadSession } from '../auth/session'
import type { User, UserStatus } from '../auth/types'
import { getCompany, updateCompany, type CompanyProfile } from './mockCompany'
import {
  getQuotationTemplate,
  updateQuotationTemplate,
  type QuotationTemplate,
} from './mockQuotationTemplate'
import { listAuditEvents, recordAuditEvent, type AuditEvent } from './mockAuditLog'
import { isAdminUser, loadRbac } from './rbac/mockRbac'
import type { UserPermission } from './rbac/rbacTypes'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const currentUserId = () => loadSession()?.user.id

/**
 * Admin data API — users, company profile and the audit log. Mock-backed like
 * the rest of the app (swap `fakeBaseQuery`/queryFns for real HTTP later).
 */
export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ['AdminUser', 'Company', 'AuditEvent', 'QuotationTemplate'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      queryFn: async () => {
        await delay(200)
        return { data: listUsers() }
      },
      providesTags: ['AdminUser'],
    }),

    addUser: builder.mutation<User, NewUser>({
      queryFn: async (body) => {
        await delay(400)
        try {
          const user = addUser(body)
          recordAuditEvent({
            module: 'admin',
            action: 'Added user',
            target: user.name,
            details: `${user.roleIds.length} role(s)`,
          })
          return { data: user }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Could not add user.' }
        }
      },
      invalidatesTags: ['AdminUser', 'AuditEvent'],
    }),

    setUserRoles: builder.mutation<User, { id: string; roleIds: string[] }>({
      queryFn: async ({ id, roleIds }) => {
        await delay(300)
        // Guard: don't let admins strip their own admin access.
        if (id === currentUserId() && !isAdminUser(loadRbac(), { roleIds })) {
          return { error: 'You cannot remove your own admin role.' }
        }
        const user = setUserRoles(id, roleIds)
        if (!user) return { error: 'User not found.' }
        recordAuditEvent({ module: 'admin', action: 'Updated user roles', target: user.name })
        return { data: user }
      },
      invalidatesTags: ['AdminUser', 'AuditEvent'],
    }),

    setUserPosition: builder.mutation<User, { id: string; positionId: string | undefined }>({
      queryFn: async ({ id, positionId }) => {
        await delay(300)
        const user = setUserPosition(id, positionId)
        if (!user) return { error: 'User not found.' }
        recordAuditEvent({ module: 'admin', action: 'Updated user position', target: user.name })
        return { data: user }
      },
      invalidatesTags: ['AdminUser', 'AuditEvent'],
    }),

    setUserPermissions: builder.mutation<User, { id: string; userPermissions: UserPermission[] }>({
      queryFn: async ({ id, userPermissions }) => {
        await delay(300)
        const user = setUserPermissions(id, userPermissions)
        if (!user) return { error: 'User not found.' }
        recordAuditEvent({ module: 'admin', action: 'Updated user permission overrides', target: user.name })
        return { data: user }
      },
      invalidatesTags: ['AdminUser', 'AuditEvent'],
    }),

    setUserStatus: builder.mutation<User, { id: string; status: UserStatus }>({
      queryFn: async ({ id, status }) => {
        await delay(300)
        if (id === currentUserId() && status === 'inactive') {
          return { error: 'You cannot deactivate your own account.' }
        }
        const user = setUserStatus(id, status)
        if (!user) return { error: 'User not found.' }
        recordAuditEvent({
          module: 'admin',
          action: status === 'active' ? 'Activated user' : 'Deactivated user',
          target: user.name,
        })
        return { data: user }
      },
      invalidatesTags: ['AdminUser', 'AuditEvent'],
    }),

    getCompany: builder.query<CompanyProfile, void>({
      queryFn: async () => {
        await delay(150)
        return { data: getCompany() }
      },
      providesTags: ['Company'],
    }),

    updateCompany: builder.mutation<CompanyProfile, Partial<CompanyProfile>>({
      queryFn: async (patch) => {
        await delay(400)
        return { data: updateCompany(patch) }
      },
      invalidatesTags: ['Company', 'AuditEvent'],
    }),

    getQuotationTemplate: builder.query<QuotationTemplate, void>({
      queryFn: async () => {
        await delay(150)
        return { data: getQuotationTemplate() }
      },
      providesTags: ['QuotationTemplate'],
    }),

    updateQuotationTemplate: builder.mutation<QuotationTemplate, Partial<QuotationTemplate>>({
      queryFn: async (patch) => {
        await delay(400)
        return { data: updateQuotationTemplate(patch) }
      },
      invalidatesTags: ['QuotationTemplate', 'AuditEvent'],
    }),

    getAuditEvents: builder.query<AuditEvent[], void>({
      queryFn: async () => {
        await delay(200)
        return { data: listAuditEvents() }
      },
      providesTags: ['AuditEvent'],
      // Many other apis append events; refetch on mount so the log stays fresh.
      keepUnusedDataFor: 0,
    }),
  }),
})

export const {
  useGetUsersQuery,
  useAddUserMutation,
  useSetUserRolesMutation,
  useSetUserPositionMutation,
  useSetUserPermissionsMutation,
  useSetUserStatusMutation,
  useGetCompanyQuery,
  useUpdateCompanyMutation,
  useGetQuotationTemplateQuery,
  useUpdateQuotationTemplateMutation,
  useGetAuditEventsQuery,
} = adminApi
