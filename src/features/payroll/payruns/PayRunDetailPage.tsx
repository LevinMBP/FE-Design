import { useNavigate, useParams } from 'react-router-dom'
import { App, Button, Skeleton, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useGetPayRunQuery, useMarkPayRunPaidMutation } from '../payrollApi'
import { formatPeso, type Payslip } from '../types'

const columns: ColumnsType<Payslip> = [
  {
    title: 'Employee',
    dataIndex: 'employeeName',
    fixed: 'left',
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
  { title: 'Basic', dataIndex: 'basicPay', align: 'right', render: (v: number) => formatPeso(v) },
  { title: 'Allowance', dataIndex: 'allowance', align: 'right', render: (v: number) => formatPeso(v) },
  { title: 'Gross', dataIndex: 'grossPay', align: 'right', render: (v: number) => formatPeso(v) },
  { title: 'SSS', align: 'right', render: (_, r) => formatPeso(r.deductions.sss) },
  { title: 'PhilHealth', align: 'right', render: (_, r) => formatPeso(r.deductions.philhealth) },
  { title: 'Pag-IBIG', align: 'right', render: (_, r) => formatPeso(r.deductions.pagibig) },
  { title: 'Tax', align: 'right', render: (_, r) => formatPeso(r.deductions.tax) },
  {
    title: 'Net Pay',
    dataIndex: 'netPay',
    align: 'right',
    fixed: 'right',
    render: (v: number) => <span style={{ fontWeight: 600 }}>{formatPeso(v)}</span>,
  },
]

function PayRunDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data: run, isLoading, isError } = useGetPayRunQuery(id)
  const [markPaid, { isLoading: isMarking }] = useMarkPayRunPaidMutation()

  const onMarkPaid = async () => {
    try {
      await markPaid(id).unwrap()
      message.success('Pay run marked as paid.')
    } catch {
      message.error('Could not update the pay run.')
    }
  }

  if (isLoading) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }

  if (isError || !run) {
    return (
      <div className="module-view">
        <div className="page-head">
          <div>
            <h1>Pay run not found</h1>
            <p>It may have been removed or never existed.</p>
          </div>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/payroll/pay-runs')}>
            Back to pay runs
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>
            {run.periodLabel}{' '}
            <Tag color={run.status === 'paid' ? 'green' : 'gold'}>
              {run.status === 'paid' ? 'Paid' : 'Draft'}
            </Tag>
          </h1>
          <p>
            Pay date{' '}
            {new Date(run.payDate).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · {run.headcount} employee{run.headcount === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/payroll/pay-runs')}>
            Back
          </Button>
          {run.status === 'draft' && (
            <Button
              type="primary"
              icon={<CheckCircle2 size={16} />}
              loading={isMarking}
              onClick={onMarkPaid}
            >
              Mark as paid
            </Button>
          )}
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card__value">{formatPeso(run.totalGross)}</div>
          <div className="stat-card__label">Total Gross</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{formatPeso(run.totalDeductions)}</div>
          <div className="stat-card__label">Total Deductions</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{formatPeso(run.totalNet)}</div>
          <div className="stat-card__label">Total Net Pay</div>
        </div>
      </div>

      <Table<Payslip>
        rowKey="employeeId"
        columns={columns}
        dataSource={run.payslips}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No active employees to pay.' }}
        summary={(rows) => {
          const total = rows.reduce((s, r) => s + r.netPay, 0)
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={8}>
                <span style={{ fontWeight: 600 }}>Total net pay</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">
                <span style={{ fontWeight: 700 }}>{formatPeso(total)}</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )
        }}
      />
    </div>
  )
}

export default PayRunDetailPage
