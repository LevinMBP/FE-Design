import { App, Form, Input, Modal, Switch } from 'antd'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { addRole } from './rbac/rbacSlice'
import { SEED_ORG_ID } from './rbac/mockRbac'
import { recordAuditEvent } from './mockAuditLog'

interface Values {
  name: string
  description: string
  isSystemAdmin: boolean
}

function AddRoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<Values>()
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)

  const handleOk = async () => {
    const values = await form.validateFields()
    dispatch(
      addRole({
        organizationId: user?.organizationId ?? SEED_ORG_ID,
        name: values.name.trim(),
        description: values.description?.trim() ?? '',
        isSystemAdmin: !!values.isSystemAdmin,
      }),
    )
    recordAuditEvent({ module: 'admin', action: 'Added role', target: values.name.trim() })
    message.success(`Role "${values.name.trim()}" added.`)
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="Add role"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      okText="Add role"
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark initialValues={{ isSystemAdmin: false }}>
        <Form.Item name="name" label="Role name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Accountant" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="What this role is for" />
        </Form.Item>
        <Form.Item
          name="isSystemAdmin"
          label="System administrator"
          valuePropName="checked"
          tooltip="Grants full access to every module and the admin area."
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AddRoleModal
