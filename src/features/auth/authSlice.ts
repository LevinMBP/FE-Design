import { createSlice } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import { authApi } from './authApi'
import type { User } from './types'

interface AuthState {
  user: User | null
}

const initialState: AuthState = {
  user: null,
}

/**
 * Holds the canonical current user. It stays in sync by listening to the
 * authApi endpoints (getSession / login / logout) rather than being mutated
 * directly — the API layer is the single source of truth for auth changes.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addMatcher(
        authApi.endpoints.getSession.matchFulfilled,
        (state, { payload }) => {
          state.user = payload?.user ?? null
        },
      )
      .addMatcher(
        authApi.endpoints.login.matchFulfilled,
        (state, { payload }) => {
          state.user = payload.user
        },
      )
      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.user = null
      })
      .addMatcher(
        authApi.endpoints.updateProfile.matchFulfilled,
        (state, { payload }) => {
          state.user = payload
        },
      )
  },
})

export const selectUser = (state: RootState) => state.auth.user
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.user !== null

export default authSlice.reducer
