import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  findUserByEmail,
  issueVerificationToken,
  redeemVerificationToken,
  updateUser,
} from './mockDb'
import {
  clearSession,
  loadSession,
  saveSession,
  updateStoredSessionUser,
} from './session'
import type {
  LoginRequest,
  ResendVerificationResult,
  Session,
  User,
  VerifyEmailResult,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Auth API. There's no real backend yet, so we use `fakeBaseQuery` and resolve
 * each endpoint's `queryFn` against the mock DB. To go live, swap `fakeBaseQuery`
 * for `fetchBaseQuery({ baseUrl: '/api' })` and replace the queryFns with `query`
 * definitions — the generated hooks below stay identical.
 */
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fakeBaseQuery<string>(),
  endpoints: (builder) => ({
    /** Runs once on app load to restore an existing session from storage. */
    getSession: builder.query<Session | null, void>({
      queryFn: async () => {
        await delay(700) // let the splash animation breathe
        return { data: loadSession() }
      },
    }),

    login: builder.mutation<Session, LoginRequest>({
      queryFn: async ({ email, password, remember }) => {
        await delay(800) // simulate network latency
        const user = findUserByEmail(email)
        if (!user || user.password !== password) {
          return { error: 'Invalid email or password.' }
        }

        const safeUser: User = {
          id: user.id,
          name: user.name,
          email: user.email,
          organizationId: user.organizationId,
          roleIds: [...user.roleIds],
          positionId: user.positionId,
          userPermissions: [...user.userPermissions],
          status: user.status,
        }
        const session: Session = {
          user: safeUser,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + (remember ? 30 * DAY_MS : DAY_MS),
        }

        saveSession(session, remember)
        return { data: session }
      },
    }),

    logout: builder.mutation<null, void>({
      queryFn: async () => {
        clearSession()
        return { data: null }
      },
    }),

    /**
     * Redeems the token from a confirmation email. A rejected token (expired,
     * already used, unknown) still resolves with `data` — the page shows a
     * different screen per status — so `error` means the request itself failed.
     */
    verifyEmail: builder.mutation<VerifyEmailResult, { token: string }>({
      queryFn: async ({ token }) => {
        await delay(900) // simulate network latency
        return { data: redeemVerificationToken(token) }
      },
    }),

    /** Mails a fresh link when the one the user clicked has expired. */
    resendVerification: builder.mutation<
      ResendVerificationResult,
      { token: string }
    >({
      queryFn: async ({ token }) => {
        await delay(800)
        const issued = issueVerificationToken(token)
        if (!issued) return { error: 'We could not find that account.' }
        return { data: issued }
      },
    }),

    updateProfile: builder.mutation<User, { id: string; name: string }>({
      queryFn: async ({ id, name }) => {
        await delay(400)
        const updated = updateUser(id, { name })
        if (!updated) return { error: 'User not found.' }
        updateStoredSessionUser(updated)
        return { data: updated }
      },
    }),
  }),
})

export const {
  useGetSessionQuery,
  useLoginMutation,
  useLogoutMutation,
  useResendVerificationMutation,
  useUpdateProfileMutation,
  useVerifyEmailMutation,
} = authApi
