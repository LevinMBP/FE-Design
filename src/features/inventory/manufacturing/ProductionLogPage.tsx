import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DatePicker, Empty, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { Factory, Plus } from 'lucide-react'
import { useGetManufactureRunsQuery } from '../inventoryApi'
import type { ManufactureRun, ManufactureRunLine } from '../types'
import './ManufacturePage.css'

const money = (v: number) => `$${v.toFixed(2)}`

const runLineColumns: ColumnsType<ManufactureRunLine> = [
  { title: 'Material', dataIndex: 'materialName' },
  {
    title: 'Qty',
    dataIndex: 'quantity',
    align: 'right',
    render: (q: number, l) => `${q} ${l.unit}`,
  },
  { title: 'Unit cost', dataIndex: 'unitCost', align: 'right', render: money },
  { title: 'Cost', dataIndex: 'cost', align: 'right', render: (v: number) => <strong>{money(v)}</strong> },
]

function ProductionLogPage() {
  const navigate = useNavigate()
  const { data: runs, isLoading } = useGetManufactureRunsQuery()
  const [date, setDate] = useState<Dayjs | null>(null)

  const filtered = useMemo(() => {
    if (!date) return runs ?? []
    return (runs ?? []).filter((r) => dayjs(r.date).isSame(date, 'day'))
  }, [runs, date])

  const totalOutput = filtered.reduce((s, r) => s + r.outputQuantity, 0)
  const totalMaterialCost = filtered.reduce((s, r) => s + r.materialCost, 0)

  const columns: ColumnsType<ManufactureRun> = [
    {
      title: 'Date',
      dataIndex: 'date',
      render: (d: string) => dayjs(d).format('MMM D, YYYY HH:mm'),
    },
    { title: 'Ref', dataIndex: 'reference' },
    { title: 'Product', dataIndex: 'productName' },
    { title: 'Output', dataIndex: 'outputQuantity', align: 'right' },
    {
      title: 'Workers',
      dataIndex: 'workers',
      render: (workers: ManufactureRun['workers']) =>
        workers.length === 0 ? (
          <span className="prod-log__none">—</span>
        ) : (
          <span className="prod-log__workers">
            {workers.map((w) => (
              <Tag key={w.id}>{w.name}</Tag>
            ))}
          </span>
        ),
    },
    { title: 'Material cost', dataIndex: 'materialCost', align: 'right', render: money },
    {
      title: 'Unit cost',
      dataIndex: 'unitCost',
      align: 'right',
      render: (v: number) => <strong>{money(v)}</strong>,
    },
  ]

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Production log</h1>
          <p>What was made, when, by whom — with material and unit cost.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => navigate('/inventory/manufacturing/new')}>
          New production
        </Button>
      </div>

      <div className="prod-log__toolbar">
        <div className="prod-log__filter">
          <span className="mfg__label" style={{ margin: 0 }}>Made on</span>
          <DatePicker value={date} onChange={setDate} format="MMM D, YYYY" placeholder="All dates" allowClear />
        </div>
        <div className="prod-log__stats">
          <span><strong>{filtered.length}</strong> runs</span>
          <span><strong>{totalOutput}</strong> units produced</span>
          <span>Material cost <strong>{money(totalMaterialCost)}</strong></span>
        </div>
      </div>

      <Table<ManufactureRun>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={isLoading}
        pagination={{ pageSize: 12, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <Empty
              image={<Factory size={40} strokeWidth={1.5} />}
              description={date ? 'Nothing produced on this date.' : 'No production runs yet.'}
            />
          ),
        }}
        expandable={{
          expandedRowRender: (run) => (
            <Table<ManufactureRunLine>
              rowKey="materialId"
              size="small"
              columns={runLineColumns}
              dataSource={run.lines}
              pagination={false}
            />
          ),
        }}
      />
    </div>
  )
}

export default ProductionLogPage
