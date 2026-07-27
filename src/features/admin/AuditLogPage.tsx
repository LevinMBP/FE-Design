import { useMemo, useState } from 'react'
import { Button, DatePicker, Empty, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { RefreshCw, ScrollText } from 'lucide-react'
import { useGetAuditEventsQuery } from './adminApi'
import type { AuditEvent, AuditModule } from './mockAuditLog'

const MODULE_LABELS: Record<AuditModule, string> = {
  inventory: 'Inventory',
  purchases: 'Purchases',
  sales: 'Sales',
  finance: 'Finance',
  accounting: 'Accounting',
  payroll: 'Payroll',
  admin: 'Admin',
  system: 'System',
}
const MODULE_COLOR: Partial<Record<AuditModule, string>> = {
  inventory: 'blue',
  purchases: 'geekblue',
  sales: 'magenta',
  finance: 'gold',
  accounting: 'green',
  payroll: 'purple',
  admin: 'red',
}

function AuditLogPage() {
  const { data: events, isFetching, refetch } = useGetAuditEventsQuery()
  const [actor, setActor] = useState<string | undefined>(undefined)
  const [module, setModule] = useState<AuditModule | undefined>(undefined)
  const [date, setDate] = useState<Dayjs | null>(null)

  const actorOptions = useMemo(() => {
    const names = Array.from(new Set((events ?? []).map((e) => e.actorName)))
    return names.map((n) => ({ value: n, label: n }))
  }, [events])

  const filtered = useMemo(
    () =>
      (events ?? []).filter(
        (e) =>
          (!actor || e.actorName === actor) &&
          (!module || e.module === module) &&
          (!date || dayjs(e.time).isSame(date, 'day')),
      ),
    [events, actor, module, date],
  )

  const columns: ColumnsType<AuditEvent> = [
    {
      title: 'Time',
      dataIndex: 'time',
      render: (t: string) => dayjs(t).format('MMM D, YYYY HH:mm'),
      defaultSortOrder: 'descend',
      sorter: (a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf(),
    },
    {
      title: 'Actor',
      dataIndex: 'actorName',
      render: (name: string, e) => (
        <span>
          {name} <span style={{ color: 'var(--text-subtle)' }}>({e.actorRole})</span>
        </span>
      ),
    },
    {
      title: 'Module',
      dataIndex: 'module',
      render: (m: AuditModule) => <Tag color={MODULE_COLOR[m]}>{MODULE_LABELS[m]}</Tag>,
    },
    { title: 'Action', dataIndex: 'action' },
    {
      title: 'Target',
      dataIndex: 'target',
      render: (t?: string) => t ?? <span style={{ color: 'var(--text-subtle)' }}>—</span>,
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Audit Log</h1>
          <p>Who did what, and when, across the app.</p>
        </div>
        <Button icon={<RefreshCw size={15} />} onClick={() => refetch()} loading={isFetching}>
          Refresh
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="All actors"
          style={{ minWidth: 180 }}
          value={actor}
          onChange={setActor}
          options={actorOptions}
        />
        <Select
          allowClear
          placeholder="All modules"
          style={{ minWidth: 160 }}
          value={module}
          onChange={setModule}
          options={(Object.keys(MODULE_LABELS) as AuditModule[]).map((m) => ({
            value: m,
            label: MODULE_LABELS[m],
          }))}
        />
        <DatePicker value={date} onChange={setDate} format="MMM D, YYYY" placeholder="All dates" allowClear />
      </div>

      <Table<AuditEvent>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={isFetching}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: <Empty image={<ScrollText size={40} strokeWidth={1.5} />} description="No matching events." />,
        }}
      />
    </div>
  )
}

export default AuditLogPage
