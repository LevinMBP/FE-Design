import { useState } from 'react'
import { App, Button, Form, Input, Modal, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { addOrganization, selectRbac } from './rbac/rbacSlice'
import { recordAuditEvent } from './mockAuditLog'
import type { Organization } from './rbac/rbacTypes'

interface Values {
  name: string
  code: string
}

function OrganizationsPage() {
  const rbac = useAppSelector(selectRbac)
  const dispatch = useAppDispatch()
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<Values>()

  const handleOk = async () => {
    const values = await form.validateFields()
    dispatch(addOrganization({ name: values.name.trim(), code: values.code.trim(), status: 'active' }))
    recordAuditEvent({ module: 'admin', action: 'Added organization', target: values.name.trim() })
    message.success(`Organization "${values.name.trim()}" added.`)
    form.resetFields()
    setOpen(false)
  }

  const columns: ColumnsType<Organization> = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: Organization['status']) =>
        status === 'active' ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Organizations</h1>
          <p>The tenant your users, roles and positions belong to.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
          Add organization
        </Button>
      </div>

      <Table<Organization>
        rowKey="id"
        columns={columns}
        dataSource={rbac.organizations}
        pagination={{ hideOnSinglePage: true }}
      />

      <Modal
        title="Add organization"
        open={open}
        onOk={handleOk}
        onCancel={() => {
          form.resetFields()
          setOpen(false)
        }}
        okText="Add organization"
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Acme Trading Corp." />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code is required' }]}>
            <Input placeholder="e.g. ACME" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrganizationsPage
