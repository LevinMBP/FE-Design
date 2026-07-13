import { useNavigate } from 'react-router-dom'
import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Pencil } from 'lucide-react'
import { useGetCompensationsQuery } from '../payrollApi'
import { formatPeso, type CompensationRow } from '../types'

function CompensationPage() {
  const { data: rows, isLoading } = useGetCompensationsQuery()
  const navigate = useNavigate()

  const columns: ColumnsType<CompensationRow> = [
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      sorter: (a, b) => a.employeeName.localeCompare(b.employeeName),
      render: (name: string, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {r.position && (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
              {r.position}
            </div>
          )}
        </div>
      ),
    },
    { title: 'Department', dataIndex: 'department', render: (v: string) => v || '—' },
    {
      title: 'Basic Pay',
      dataIndex: 'basicPay',
      align: 'right',
      sorter: (a, b) => a.basicPay - b.basicPay,
      render: (v: number) => formatPeso(v),
    },
    {
      title: 'Allowance',
      dataIndex: 'allowance',
      align: 'right',
      render: (v: number) => formatPeso(v),
    },
    {
      title: 'Monthly Gross',
      dataIndex: 'grossPay',
      align: 'right',
      sorter: (a, b) => a.grossPay - b.grossPay,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{formatPeso(v)}</span>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          icon={<Pencil size={14} />}
          onClick={() => navigate(`/payroll/compensation/${r.employeeId}`)}
        >
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Compensation</h1>
          <p>Set monthly basic pay and allowances that drive payroll.</p>
        </div>
      </div>

      <Table<CompensationRow>
        rowKey="employeeId"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No active employees. Add employees in Contacts first.' }}
      />
    </div>
  )
}

export default CompensationPage
