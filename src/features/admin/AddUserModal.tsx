import { App, Form, Input, Modal, Select } from 'antd'
import { useAppSelector } from '../../app/hooks'
import { useAddUserMutation } from './adminApi'
import { selectRbac } from './rbac/rbacSlice'

interface Values {
  name: string
  email: string
  password: string
  roleIds: string[]
  positionId?: string
}

function AddUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<Values>()
  const { message } = App.useApp()
  const [addUser, { isLoading }] = useAddUserMutation()
  const rbac = useAppSelector(selectRbac)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await addUser(values).unwrap()
      message.success(`${values.name} added.`)
      form.resetFields()
      onClose()
    } catch (err) {
      if (typeof err === 'string') message.error(err)
      // validation errors are shown inline by the form
    }
  }

  return (
    <Modal
      title="Add user"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      confirmLoading={isLoading}
      okText="Add user"
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item name="name" label="Full name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="Jane Dela Cruz" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Enter a valid email' },
          ]}
        >
          <Input placeholder="jane@venturo.app" />
        </Form.Item>
        <Form.Item name="positionId" label="Position">
          <Select
            allowClear
            placeholder="Select a position"
            options={rbac.positions.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Form.Item>
        <Form.Item name="roleIds" label="Roles" rules={[{ required: true, message: 'Pick at least one role' }]}>
          <Select
            mode="multiple"
            placeholder="Assign role(s)"
            options={rbac.roles.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Form.Item>
        <Form.Item
          name="password"
          label="Temporary password"
          tooltip="The user signs in with this; they can change it later."
          rules={[{ required: true, message: 'Set a temporary password' }, { min: 6, message: 'At least 6 characters' }]}
        >
          <Input.Password placeholder="At least 6 characters" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AddUserModal
