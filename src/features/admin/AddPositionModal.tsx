import { App, Form, Input, Modal } from 'antd'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectUser } from '../auth/authSlice'
import { addPosition } from './rbac/rbacSlice'
import { SEED_ORG_ID } from './rbac/mockRbac'
import { recordAuditEvent } from './mockAuditLog'

interface Values {
  name: string
  description: string
}

function AddPositionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<Values>()
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectUser)

  const handleOk = async () => {
    const values = await form.validateFields()
    dispatch(
      addPosition({
        organizationId: user?.organizationId ?? SEED_ORG_ID,
        name: values.name.trim(),
        description: values.description?.trim() ?? '',
      }),
    )
    recordAuditEvent({ module: 'admin', action: 'Added position', target: values.name.trim() })
    message.success(`Position "${values.name.trim()}" added.`)
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="Add position"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      okText="Add position"
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item name="name" label="Position name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Sales Associate" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="What this position does" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AddPositionModal
