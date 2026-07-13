import { Badge, Empty, Popover } from 'antd'
import { Bell } from 'lucide-react'
import { useGetNotificationsQuery } from '../features/notifications/notificationsApi'
import './NotificationBell.css'

function NotificationBell() {
  const { data: notifications } = useGetNotificationsQuery()
  const unread = notifications?.filter((n) => !n.read).length ?? 0

  const content =
    !notifications || notifications.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications" />
    ) : (
      <div className="notif">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notif__item ${!n.read ? 'notif__item--unread' : ''}`}
          >
            {!n.read && <span className="notif__dot" />}
            <div className="notif__body">
              <div className="notif__title">{n.title}</div>
              <div className="notif__time">{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    )

  return (
    <Popover
      content={content}
      title="Notifications"
      trigger="click"
      placement="bottomRight"
      overlayStyle={{ width: 320 }}
    >
      <button type="button" className="bell" aria-label="Notifications">
        <Badge dot={unread > 0} offset={[-1, 2]}>
          <Bell size={20} />
        </Badge>
      </button>
    </Popover>
  )
}

export default NotificationBell
