import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from './hooks'
import { selectIsAuthenticated } from '../features/auth/authSlice'

/** Gate for protected routes — bounces unauthenticated users to /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default RequireAuth
