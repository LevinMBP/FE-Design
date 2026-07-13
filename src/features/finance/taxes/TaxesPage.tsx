import { Link } from 'react-router-dom'
import { Button, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetTaxesQuery } from '../financeApi'
import { useGetAccountsQuery } from '../../accounting/accountingApi'
import { TAX_ACCOUNT_PURPOSES, taxAccountPurposeLabel, type Tax } from '../types'

function TaxesPage() {
  const { data: taxes, isLoading } = useGetTaxesQuery()
  const { data: accounts } = useGetAccountsQuery()

  const accountLabel = (id: string) => {
    const account = accounts?.find((a) => a.id === id)
    return account ? `${account.code} · ${account.name}` : id
  }

  const columns: ColumnsType<Tax> = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {r.description && (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
              {r.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      align: 'right',
      sorter: (a, b) => a.rate - b.rate,
      render: (rate: number) => `${rate}%`,
    },
    {
      title: 'GL accounts',
      dataIndex: 'accounts',
      filters: TAX_ACCOUNT_PURPOSES.map((p) => ({ text: p.label, value: p.value })),
      onFilter: (value, r) => r.accounts.some((a) => a.purpose === value),
      render: (accountsForTax: Tax['accounts']) =>
        accountsForTax.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {accountsForTax.map((a) => (
              <Tooltip key={a.id} title={accountLabel(a.glAccountId)}>
                <Tag>{taxAccountPurposeLabel(a.purpose)}</Tag>
              </Tooltip>
            ))}
          </div>
        ) : (
          <span className="text-tertiary">Not configured</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center',
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Inactive', value: 'inactive' },
      ],
      onFilter: (value, r) => r.status === value,
      render: (status: Tax['status']) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Taxes</h1>
          <p>Configure tax rates and the GL accounts they post to.</p>
        </div>
        <Link to="/finance/taxes/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New tax
          </Button>
        </Link>
      </div>

      <Table<Tax>
        rowKey="id"
        columns={columns}
        dataSource={taxes}
        loading={isLoading}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default TaxesPage
