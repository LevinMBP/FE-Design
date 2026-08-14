import { Button, InputNumber, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  allocatedTotal,
  round2,
  type AllocatableDoc,
} from '../settlement'

const peso = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)

/** Withholding is optional; when on, each row splits into tax and net cash. */
export interface WithholdingColumn {
  amounts: Record<string, number>
  onChange: (key: string, amount: number) => void
  /** Column header, e.g. "WHT 2%". */
  label: string
  /** Header for the money that actually moves, e.g. "Net cash paid". */
  netLabel: string
}

/**
 * The allocation grid shared by vendor payments and customer collections: one
 * row per open document, with the amount being applied to it. It owns no state
 * — the parent form holds the amounts map so it can auto-allocate, clear, and
 * total the document.
 *
 * With `withholding` set, the row's applied amount is what settles the document
 * and the withheld tax is carved out of it, leaving the net cash that changes
 * hands.
 */
function AllocationTable({
  docs,
  amounts,
  onChange,
  loading,
  emptyText,
  amountLabel = 'This payment',
  withholding,
}: {
  docs: AllocatableDoc[]
  amounts: Record<string, number>
  onChange: (key: string, amount: number) => void
  loading?: boolean
  emptyText: string
  amountLabel?: string
  withholding?: WithholdingColumn
}) {
  const whtOf = (key: string) => round2(withholding?.amounts[key] ?? 0)

  const columns: ColumnsType<AllocatableDoc> = [
    {
      title: 'Document',
      key: 'reference',
      render: (_, r) => (
        <span>
          <strong>{r.reference}</strong>
          {r.badge && (
            <Tag color={r.badge.color} style={{ marginLeft: 8 }}>
              {r.badge.label}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      render: (d: string) => dayjs(d).format('MMM D, YYYY'),
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      render: (d: string | undefined) => {
        if (!d) return '—'
        const overdue = dayjs(d).isBefore(dayjs(), 'day')
        return (
          <span style={overdue ? { color: 'var(--danger, #cf1322)' } : undefined}>
            {dayjs(d).format('MMM D, YYYY')}
            {overdue && ' · overdue'}
          </span>
        )
      },
    },
    { title: 'Total', dataIndex: 'total', align: 'right', render: peso },
    {
      title: 'Already paid',
      dataIndex: 'amountPaid',
      align: 'right',
      render: (v: number) => (v > 0 ? peso(v) : '—'),
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding',
      align: 'right',
      render: (v: number) => <strong>{peso(v)}</strong>,
    },
    {
      title: amountLabel,
      key: 'amount',
      align: 'right',
      width: 210,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <InputNumber
            aria-label={`Amount for ${r.reference}`}
            value={amounts[r.key] ?? null}
            min={0}
            max={r.outstanding}
            step={0.01}
            prefix="₱"
            placeholder="0.00"
            style={{ width: 140 }}
            onChange={(v) => onChange(r.key, round2(Number(v) || 0))}
          />
          <Button
            size="small"
            type="link"
            disabled={round2(amounts[r.key] ?? 0) === r.outstanding}
            onClick={() => onChange(r.key, r.outstanding)}
          >
            Full
          </Button>
        </div>
      ),
    },
  ]

  if (withholding) {
    columns.push(
      {
        title: withholding.label,
        key: 'wht',
        align: 'right',
        width: 150,
        render: (_, r) => (
          <InputNumber
            aria-label={`Withholding for ${r.reference}`}
            value={withholding.amounts[r.key] ?? null}
            min={0}
            max={round2(amounts[r.key] ?? 0)}
            step={0.01}
            prefix="₱"
            placeholder="0.00"
            style={{ width: 130 }}
            disabled={!amounts[r.key]}
            onChange={(v) => withholding.onChange(r.key, round2(Number(v) || 0))}
          />
        ),
      },
      {
        title: withholding.netLabel,
        key: 'net',
        align: 'right',
        render: (_, r) => {
          const net = round2((amounts[r.key] ?? 0) - whtOf(r.key))
          return net > 0 ? <strong>{peso(net)}</strong> : '—'
        },
      },
    )
  }

  return (
    <Table<AllocatableDoc>
      rowKey="key"
      size="small"
      columns={columns}
      dataSource={docs}
      loading={loading}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText }}
      summary={(rows) =>
        rows.length ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={5}>
              <strong>{rows.length} open document{rows.length === 1 ? '' : 's'}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              <strong>{peso(round2(rows.reduce((s, r) => s + r.outstanding, 0)))}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              <strong>{peso(allocatedTotal(amounts))}</strong>
            </Table.Summary.Cell>
            {withholding && (
              <>
                <Table.Summary.Cell index={7} align="right">
                  <strong>{peso(allocatedTotal(withholding.amounts))}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <strong>
                    {peso(
                      round2(
                        allocatedTotal(amounts) - allocatedTotal(withholding.amounts),
                      ),
                    )}
                  </strong>
                </Table.Summary.Cell>
              </>
            )}
          </Table.Summary.Row>
        ) : null
      }
    />
  )
}

export default AllocationTable
