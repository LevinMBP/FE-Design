import { Link } from 'react-router-dom'
import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useGetAccountsQuery, useGetJournalEntriesQuery } from '../accountingApi'
import { formatPeso, type JournalEntry, type JournalLine } from '../types'

function JournalEntriesPage() {
  const { data: entries, isLoading } = useGetJournalEntriesQuery()
  const { data: accounts } = useGetAccountsQuery()

  const nameOf = (id: string) => {
    const a = accounts?.find((x) => x.id === id)
    return a ? `${a.code} · ${a.name}` : id
  }

  const columns: ColumnsType<JournalEntry> = [
    {
      title: 'Reference',
      dataIndex: 'reference',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.date.localeCompare(b.date),
      render: (d: string) => dayjs(d).format('MMM D, YYYY'),
    },
    { title: 'Memo', dataIndex: 'memo', render: (v: string) => v || '—' },
    {
      title: 'Amount',
      dataIndex: 'totalDebit',
      align: 'right',
      render: (v: number) => formatPeso(v),
    },
  ]

  const lineColumns: ColumnsType<JournalLine> = [
    { title: 'Account', render: (_, l) => nameOf(l.accountId) },
    { title: 'Debit', dataIndex: 'debit', align: 'right', render: (v: number) => (v ? formatPeso(v) : '—') },
    { title: 'Credit', dataIndex: 'credit', align: 'right', render: (v: number) => (v ? formatPeso(v) : '—') },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Journal Entries</h1>
          <p>Every posted double-entry transaction. Debits always equal credits.</p>
        </div>
        <Link to="/accounting/journal/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New entry
          </Button>
        </Link>
      </div>

      <Table<JournalEntry>
        rowKey="id"
        columns={columns}
        dataSource={entries}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (r) => (
            <Table<JournalLine>
              rowKey={(l) => `${l.accountId}-${l.debit}-${l.credit}`}
              columns={lineColumns}
              dataSource={r.lines}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ),
        }}
      />
    </div>
  )
}

export default JournalEntriesPage
