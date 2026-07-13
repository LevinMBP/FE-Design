import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetEmployeesQuery } from '../contactsApi'
import { DEPARTMENTS, type Employee } from '../types'

const columns: ColumnsType<Employee> = [
  {
    title: 'Name',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span>,
  },
  { title: 'Position', dataIndex: 'position' },
  {
    title: 'Department',
    dataIndex: 'department',
    filters: DEPARTMENTS.map((d) => ({ text: d, value: d })),
    onFilter: (value, r) => r.department === value,
    render: (department: string) => <Tag color="blue">{department}</Tag>,
  },
  { title: 'Email', dataIndex: 'email' },
  { title: 'Phone', dataIndex: 'phone' },
  {
    title: 'Status',
    dataIndex: 'status',
    align: 'center',
    filters: [
      { text: 'Active', value: 'active' },
      { text: 'Inactive', value: 'inactive' },
    ],
    onFilter: (value, r) => r.status === value,
    render: (status: Employee['status']) => (
      <Tag color={status === 'active' ? 'green' : 'default'}>
        {status === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function EmployeesPage() {
  const { data: employees, isLoading } = useGetEmployeesQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Employees</h1>
          <p>Your team members.</p>
        </div>
        <Link to="/finance/employees/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New employee
          </Button>
        </Link>
      </div>

      <Table<Employee>
        rowKey="id"
        columns={columns}
        dataSource={employees}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default EmployeesPage
