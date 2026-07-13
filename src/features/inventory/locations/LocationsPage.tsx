import { Link } from 'react-router-dom'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus } from 'lucide-react'
import { useGetLocationsQuery } from '../inventoryApi'
import { LOCATION_TYPE_LABELS, type InventoryLocation } from '../types'

const columns: ColumnsType<InventoryLocation> = [
  {
    title: 'Name',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string, l: InventoryLocation) => (
      <Link to={`/inventory/locations/${l.id}`}>{name}</Link>
    ),
  },
  { title: 'Code', dataIndex: 'code', render: (v: string) => v || '—' },
  {
    title: 'Type',
    dataIndex: 'type',
    render: (t: InventoryLocation['type']) => LOCATION_TYPE_LABELS[t],
  },
  { title: 'Address', dataIndex: 'address', render: (v: string) => v || '—' },
  {
    title: 'Status',
    dataIndex: 'status',
    render: (s: InventoryLocation['status']) => (
      <Tag color={s === 'active' ? 'success' : 'default'}>
        {s === 'active' ? 'Active' : 'Inactive'}
      </Tag>
    ),
  },
]

function LocationsPage() {
  const { data: locations, isLoading } = useGetLocationsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Locations</h1>
          <p>Warehouses and storage places your stock lives in.</p>
        </div>
        <Link to="/inventory/locations/new">
          <Button type="primary" icon={<Plus size={16} />}>
            New location
          </Button>
        </Link>
      </div>

      <Table<InventoryLocation>
        rowKey="id"
        columns={columns}
        dataSource={locations}
        loading={isLoading}
        pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default LocationsPage
