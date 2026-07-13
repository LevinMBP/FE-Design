import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetMaterialsQuery } from '../inventoryApi'
import type { Material } from '../types'

const columns: ColumnsType<Material> = [
  {
    title: 'Name',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string, m: Material) => (
      <Link to={`/inventory/materials/${m.id}`}>{name}</Link>
    ),
  },
  { title: 'SKU', dataIndex: 'sku' },
  { title: 'Unit', dataIndex: 'unit' },
  { title: 'Packaging', dataIndex: 'packaging', render: (v: string) => v || '—' },
  {
    title: 'On hand',
    dataIndex: 'quantity',
    align: 'right',
    sorter: (a, b) => a.quantity - b.quantity,
    render: (_: number, m: Material) => (
      <span>
        {m.quantity}
        {m.quantity < m.minStock && (
          <Tag color="error" style={{ marginInlineStart: 8 }}>
            Low
          </Tag>
        )}
      </span>
    ),
  },
  { title: 'Min', dataIndex: 'minStock', align: 'right' },
  { title: 'Max', dataIndex: 'maxStock', align: 'right' },
  {
    title: 'Unit cost',
    dataIndex: 'unitCost',
    align: 'right',
    render: (v: number) => `$${v.toFixed(2)}`,
  },
]

function MaterialsPage() {
  const { data: materials, isLoading } = useGetMaterialsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Materials</h1>
          <p>Raw materials used to build finished products.</p>
        </div>
        <Link to="/inventory/materials/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New material
          </Button>
        </Link>
      </div>

      <Table<Material>
        rowKey="id"
        columns={columns}
        dataSource={materials}
        loading={isLoading}
        rowSelection={{ type: 'checkbox' }}
        pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default MaterialsPage
