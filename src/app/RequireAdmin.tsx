import { useMemo, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from './hooks'
import { selectIsAuthenticated, selectUser } from '../features/auth/authSlice'
import { selectRbac } from '../features/admin/rbac/rbacSlice'
import { isAdminUser } from '../features/admin/rbac/mockRbac'

/** Gate for the admin area — bounces unauthenticated users to /login and non-admins home. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const user = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)
  const isAdmin = useMemo(() => (user ? isAdminUser(rbac, user) : false), [rbac, user])
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default RequireAdmin
