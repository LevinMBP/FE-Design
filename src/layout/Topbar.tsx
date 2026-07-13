import { Link } from 'react-router-dom'
import UserMenu from './UserMenu'
import BrandMark from '../shared/components/BrandMark'
import './Topbar.css'

interface TopbarProps {
  /** Breadcrumb shown next to the brand; links back to the module home. */
  moduleName?: string
  /** Route the module breadcrumb links to (e.g. "/inventory"). */
  moduleTo?: string
}

function Topbar({ moduleName, moduleTo }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <Link className="topbar__brand" to="/" aria-label="Back to modules">
          <BrandMark size={24} />
          <span>Venturo</span>
        </Link>
        {moduleName && (
          <>
            <span className="topbar__sep" aria-hidden="true">
              /
            </span>
            {moduleTo ? (
              <Link className="topbar__module topbar__module--link" to={moduleTo}>
                {moduleName}
              </Link>
            ) : (
              <span className="topbar__module">{moduleName}</span>
            )}
          </>
        )}
      </div>
      <UserMenu />
    </header>
  )
}

export default Topbar
