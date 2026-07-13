import { Link } from 'react-router-dom'
import { Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Factory, Plus } from 'lucide-react'
import { useGetProductsQuery } from '../inventoryApi'
import { PRODUCT_TYPE_LABELS, type Product, type ProductType } from '../types'

const TYPE_COLOR: Record<ProductType, string> = {
  manufactured: 'geekblue',
  imported: 'green',
  local_purchase: 'gold',
}

const columns: ColumnsType<Product> = [
  {
    title: 'Name',
    dataIndex: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name: string, p: Product) => (
      <Link to={`/inventory/products/${p.id}`}>{name}</Link>
    ),
  },
  { title: 'SKU', dataIndex: 'sku' },
  {
    title: 'Type',
    dataIndex: 'type',
    filters: (Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((t) => ({
      text: PRODUCT_TYPE_LABELS[t],
      value: t,
    })),
    onFilter: (value, record) => record.type === value,
    render: (type: ProductType) => (
      <Tag color={TYPE_COLOR[type]}>{PRODUCT_TYPE_LABELS[type]}</Tag>
    ),
  },
  {
    title: 'In stock',
    dataIndex: 'quantity',
    align: 'right',
    sorter: (a, b) => a.quantity - b.quantity,
  },
  {
    title: 'Price',
    dataIndex: 'price',
    align: 'right',
    render: (v: number) => `$${v.toFixed(2)}`,
  },
]

function ProductsPage() {
  const { data: products, isLoading } = useGetProductsQuery()

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>Imported, local-purchase and manufactured products.</p>
        </div>
        <Space>
          <Link to="/inventory/manufacturing">
            <Button icon={<Factory size={16} />}>Manufacture</Button>
          </Link>
          <Link to="/inventory/products/new">
            <Button type="primary" icon={<Plus size={16} />}>
              New product
            </Button>
          </Link>
        </Space>
      </div>

      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products}
        loading={isLoading}
        rowSelection={{ type: 'checkbox' }}
        pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

export default ProductsPage
