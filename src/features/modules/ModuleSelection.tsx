import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { selectRbac } from '../admin/rbac/rbacSlice'
import { allowedModulesForUser } from '../admin/rbac/mockRbac'
import Topbar from '../../layout/Topbar'
import { MODULES } from './modules'
import './ModuleSelection.css'

function ModuleSelection() {
  const user = useAppSelector(selectUser)
  const rbac = useAppSelector(selectRbac)
  const navigate = useNavigate()
  const firstName = user?.name.split(' ')[0] ?? 'there'

  const allowed = useMemo(() => (user ? allowedModulesForUser(rbac, user) : []), [rbac, user])
  const visibleModules = MODULES.filter((m) => allowed.includes(m.id))

  return (
    <div className="modules">
      <Topbar />

      <main className="modules__main">
        <header className="modules__header">
          <h1>Hi {firstName}, where to?</h1>
          <p>Choose a module to get started.</p>
        </header>

        <div className="modules__grid">
          {visibleModules.map((mod) => {
            const Icon = mod.icon
            return (
              <button
                key={mod.id}
                type="button"
                className="module-card"
                onClick={() => navigate(`/${mod.id}`)}
              >
                <span className={`module-card__icon module-card__icon--${mod.accent}`}>
                  <Icon size={24} />
                </span>
                <span className="module-card__body">
                  <span className="module-card__title-row">
                    <span className="module-card__title">{mod.name}</span>
                    {!mod.ready && (
                      <span className="module-card__soon">Coming soon</span>
                    )}
                  </span>
                  <span className="module-card__desc">{mod.description}</span>
                </span>
                <ArrowRight size={18} className="module-card__arrow" />
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default ModuleSelection
