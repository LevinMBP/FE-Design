import { useEffect, useMemo, useState } from 'react'
import { App, Alert, Button, InputNumber, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Save } from 'lucide-react'
import { useGetAccountsQuery, useSaveOpeningBalancesMutation } from '../accountingApi'
import { formatPeso, normalIsDebit, type AccountBalance } from '../types'

function OpeningBalancesPage() {
  const { message } = App.useApp()
  const { data: accounts, isLoading } = useGetAccountsQuery()
  const [save, { isLoading: isSaving }] = useSaveOpeningBalancesMutation()

  // Local editable amounts keyed by account id (each on its normal side).
  const [amounts, setAmounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (accounts) {
      setAmounts(Object.fromEntries(accounts.map((a) => [a.id, a.openingBalance])))
    }
  }, [accounts])

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const acc of accounts ?? []) {
      const amt = amounts[acc.id] ?? 0
      if (normalIsDebit(acc.type)) debit += amt
      else credit += amt
    }
    debit = Math.round(debit * 100) / 100
    credit = Math.round(credit * 100) / 100
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 }
  }, [accounts, amounts])

  const columns: ColumnsType<AccountBalance> = [
    { title: 'Code', dataIndex: 'code', width: 80 },
    {
      title: 'Account',
      dataIndex: 'name',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Side',
      align: 'center',
      render: (_, r) => (
        <Tag color={normalIsDebit(r.type) ? 'blue' : 'volcano'}>
          {normalIsDebit(r.type) ? 'Debit' : 'Credit'}
        </Tag>
      ),
    },
    {
      title: 'Opening Balance',
      align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          step={100}
          value={amounts[r.id]}
          onChange={(v) => setAmounts((prev) => ({ ...prev, [r.id]: Number(v) || 0 }))}
          style={{ width: 160 }}
          formatter={(v) => `₱ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => Number((v ?? '').replace(/[₱,\s]/g, '')) || 0}
        />
      ),
    },
  ]

  const onSave = async () => {
    try {
      await save(
        Object.entries(amounts).map(([accountId, openingBalance]) => ({
          accountId,
          openingBalance,
        })),
      ).unwrap()
      message.success('Opening balances saved.')
    } catch {
      message.error('Could not save opening balances.')
    }
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Opening Balances</h1>
          <p>Set each account's starting balance. Total debits should equal total credits.</p>
        </div>
        <Button type="primary" icon={<Save size={16} />} loading={isSaving} onClick={onSave}>
          Save opening balances
        </Button>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type={totals.diff === 0 ? 'success' : 'warning'}
        showIcon
        message={
          totals.diff === 0
            ? `Balanced — debits and credits both total ${formatPeso(totals.debit)}.`
            : `Out of balance by ${formatPeso(Math.abs(totals.diff))} — debits ${formatPeso(totals.debit)} vs credits ${formatPeso(totals.credit)}.`
        }
      />

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

export default OpeningBalancesPage
