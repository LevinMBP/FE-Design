import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useGetAccountsQuery } from '../accountingApi'
import { accountTypeLabel, formatPeso, type AccountBalance, type AccountType } from '../types'

const TYPE_COLOR: Record<AccountType, string> = {
  asset: 'blue',
  liability: 'volcano',
  equity: 'purple',
  income: 'green',
  expense: 'gold',
}

const columns: ColumnsType<AccountBalance> = [
  {
    title: 'Code',
    dataIndex: 'code',
    width: 90,
    sorter: (a, b) => a.code.localeCompare(b.code),
    defaultSortOrder: 'ascend',
    render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
  },
  {
    title: 'Account',
    dataIndex: 'name',
    render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Type',
    dataIndex: 'type',
    filters: (['asset', 'liability', 'equity', 'income', 'expense'] as AccountType[]).map(
      (t) => ({ text: accountTypeLabel(t), value: t }),
    ),
    onFilter: (value, r) => r.type === value,
    render: (t: AccountType) => <Tag color={TYPE_COLOR[t]}>{accountTypeLabel(t)}</Tag>,
  },
  {
    title: 'Debit',
    dataIndex: 'debit',
    align: 'right',
    render: (v: number) => (v ? formatPeso(v) : '—'),
  },
  {
    title: 'Credit',
    dataIndex: 'credit',
    align: 'right',
    render: (v: number) => (v ? formatPeso(v) : '—'),
  },
]

function ChartOfAccountsPage() {
  const { data: accounts, isLoading } = useGetAccountsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Chart of Accounts</h1>
          <p>Every account balances post to, with its current debit/credit balance.</p>
        </div>
      </div>

      <Table<AccountBalance>
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default ChartOfAccountsPage
