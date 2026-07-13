import { Link, useNavigate } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetPayRunsQuery } from '../payrollApi'
import { formatPeso, type PayRun } from '../types'

const columns: ColumnsType<PayRun> = [
  {
    title: 'Period',
    dataIndex: 'periodLabel',
    sorter: (a, b) => a.period.localeCompare(b.period),
    defaultSortOrder: 'descend',
    render: (label: string) => <span style={{ fontWeight: 600 }}>{label}</span>,
  },
  {
    title: 'Pay Date',
    dataIndex: 'payDate',
    render: (d: string) =>
      new Date(d).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
  },
  { title: 'Headcount', dataIndex: 'headcount', align: 'right' },
  {
    title: 'Gross',
    dataIndex: 'totalGross',
    align: 'right',
    render: (v: number) => formatPeso(v),
  },
  {
    title: 'Net Pay',
    dataIndex: 'totalNet',
    align: 'right',
    render: (v: number) => <span style={{ fontWeight: 600 }}>{formatPeso(v)}</span>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    align: 'center',
    filters: [
      { text: 'Draft', value: 'draft' },
      { text: 'Paid', value: 'paid' },
    ],
    onFilter: (value, r) => r.status === value,
    render: (status: PayRun['status']) => (
      <Tag color={status === 'paid' ? 'green' : 'gold'}>
        {status === 'paid' ? 'Paid' : 'Draft'}
      </Tag>
    ),
  },
]

function PayRunsPage() {
  const { data: payRuns, isLoading } = useGetPayRunsQuery()
  const navigate = useNavigate()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Pay Runs</h1>
          <p>Generate payroll for a period and review payslips.</p>
        </div>
        <Link to="/payroll/pay-runs/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New pay run
          </Button>
        </Link>
      </div>

      <Table<PayRun>
        rowKey="id"
        columns={columns}
        dataSource={payRuns}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => navigate(`/payroll/pay-runs/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        locale={{ emptyText: 'No pay runs yet. Create your first one.' }}
      />
    </div>
  )
}

export default PayRunsPage
