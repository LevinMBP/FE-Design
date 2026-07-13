import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useGetTrialBalanceQuery } from '../accountingApi'
import { formatPeso, type AccountBalance } from '../types'

const columns: ColumnsType<AccountBalance> = [
  { title: 'Code', dataIndex: 'code', width: 90 },
  { title: 'Account', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
  { title: 'Debit', dataIndex: 'debit', align: 'right', render: (v: number) => (v ? formatPeso(v) : '—') },
  { title: 'Credit', dataIndex: 'credit', align: 'right', render: (v: number) => (v ? formatPeso(v) : '—') },
]

function TrialBalancePage() {
  const { data, isLoading } = useGetTrialBalanceQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>
            Trial Balance{' '}
            {data && (
              <Tag color={data.balanced ? 'green' : 'red'}>
                {data.balanced ? 'Balanced' : 'Out of balance'}
              </Tag>
            )}
          </h1>
          <p>Debit and credit balance of every account. Totals must be equal.</p>
        </div>
      </div>

      <Table<AccountBalance>
        rowKey="id"
        columns={columns}
        dataSource={data?.rows}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        summary={() =>
          data ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <strong>Total</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <strong>{formatPeso(data.totalDebit)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <strong>{formatPeso(data.totalCredit)}</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null
        }
      />
    </div>
  )
}

export default TrialBalancePage
