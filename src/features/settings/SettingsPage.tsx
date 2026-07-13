import { App, Button, Card, Form, Input, Segmented, Tag } from 'antd'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { useUpdateProfileMutation } from '../auth/authApi'
import { selectTheme, setTheme } from '../ui/uiSlice'
import type { Role } from '../auth/types'
import type { ThemePreference } from '../ui/theme'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}

function SettingsPage() {
  const user = useAppSelector(selectUser)
  const theme = useAppSelector(selectTheme)
  const dispatch = useAppDispatch()
  const { message } = App.useApp()
  const [updateProfile, { isLoading }] = useUpdateProfileMutation()

  if (!user) return null

  const onFinish = async (values: { name: string }) => {
    const name = values.name.trim()
    if (name === user.name) {
      message.info('No changes to save.')
      return
    }
    try {
      await updateProfile({ id: user.id, name }).unwrap()
      message.success('Profile updated.')
    } catch {
      message.error('Could not update your profile. Please try again.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile and app preferences.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <Card title="Profile">
          <Form
            layout="vertical"
            requiredMark
            initialValues={{ name: user.name }}
            onFinish={onFinish}
          >
            <Form.Item
              name="name"
              label="Display name"
              rules={[{ required: true, message: 'Name is required' }]}
            >
              <Input placeholder="Your name" />
            </Form.Item>

            <Form.Item label="Email" tooltip="Your sign-in email can't be changed here.">
              <Input value={user.email} disabled />
            </Form.Item>

            <Form.Item label="Role">
              <Tag color="blue">{ROLE_LABELS[user.role]}</Tag>
            </Form.Item>

            <div className="form-actions">
              <Button type="primary" htmlType="submit" loading={isLoading}>
                Save changes
              </Button>
            </div>
          </Form>
        </Card>

        <Card title="Appearance">
          <Form layout="vertical">
            <Form.Item
              label="Theme"
              tooltip="Applies instantly and is remembered on this device."
              style={{ marginBottom: 0 }}
            >
              <Segmented<ThemePreference>
                value={theme}
                onChange={(value) => dispatch(setTheme(value))}
                options={[
                  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
                  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
                  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
                ]}
              />
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage
