import GlobalSearch from '../features/search/GlobalSearch'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'
import './ShellTopbar.css'

function ShellTopbar() {
  return (
    <header className="shell-topbar">
      <div className="shell-topbar__search">
        <GlobalSearch />
      </div>
      <div className="shell-topbar__right">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}

export default ShellTopbar
