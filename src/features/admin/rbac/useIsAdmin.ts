import { useMemo } from 'react'
import { useAppSelector } from '../../../app/hooks'
import { selectUser } from '../../auth/authSlice'
import { selectRbac } from './rbacSlice'
import { isAdminUser } from './mockRbac'

/** Is the signed-in user a system admin? Used to gate destructive/recovery actions. */
export function useIsAdmin(): boolean {
  const user = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)
  return useMemo(() => (user ? isAdminUser(rbac, user) : false), [rbac, user])
}
