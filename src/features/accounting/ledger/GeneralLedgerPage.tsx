import { useEffect, useState } from 'react'
import { Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useGetAccountLedgerQuery, useGetAccountsQuery } from '../accountingApi'
import { formatPeso, type LedgerRow } from '../types'

const columns: ColumnsType<LedgerRow> = [
  {
    title: 'Date',
    dataIndex: 'date',
    render: (d: string, r) => (r.opening ? <span className="text-tertiary">Opening</span> : dayjs(d).format('MMM D, YYYY')),
  },
  {
    title: 'Reference',
    dataIndex: 'reference',
    render: (v: string, r) => (r.opening ? <span className="text-tertiary">{v}</span> : v),
  },
  { title: 'Memo', dataIndex: 'memo', render: (v: string) => v || '—' },
  { title: 'Debit', dataIndex: 'debit', align: 'right', render: (v: number) => (v ? formatPeso(v) : '—') },
  { title: 'Credit', dataIndex: 'credit', align: 'right', render: (v: number) => (v ? formatPeso(v) : '—') },
  {
    title: 'Balance',
    dataIndex: 'balance',
    align: 'right',
    render: (v: number) => <strong>{formatPeso(v)}</strong>,
  },
]

function GeneralLedgerPage() {
  const { data: accounts } = useGetAccountsQuery()
  const [accountId, setAccountId] = useState<string>()

  // Default to the first account once loaded.
  useEffect(() => {
    if (!accountId && accounts && accounts.length > 0) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  const { data: ledger, isFetching } = useGetAccountLedgerQuery(accountId ?? '', {
    skip: !accountId,
  })

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>General Ledger</h1>
          <p>Every posting to an account, with its running balance.</p>
        </div>
        <Select
          showSearch
          optionFilterProp="label"
          value={accountId}
          onChange={setAccountId}
          style={{ minWidth: 260 }}
          placeholder="Select an account"
          options={(accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
        />
      </div>

      <Table<LedgerRow>
        rowKey="id"
        columns={columns}
        dataSource={ledger?.rows}
        loading={isFetching}
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowClassName={(r) => (r.opening ? 'ledger-row--opening' : '')}
      />
    </div>
  )
}

export default GeneralLedgerPage
