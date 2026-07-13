import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import {
  useAddSaleMutation,
  useGetProductsQuery,
  useGetStockItemsQuery,
} from '../inventory/inventoryApi'
import { useGetCustomersQuery } from '../contacts/contactsApi'
import DocumentForm from '../inventory/documents/DocumentForm'

function SaleFormPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data: items, isLoading: itemsLoading } = useGetStockItemsQuery()
  const { data: products } = useGetProductsQuery()
  const { data: customers } = useGetCustomersQuery()
  const [addSale, { isLoading }] = useAddSaleMutation()

  // Default a sale line's unit price to the product's selling price.
  const priceById = useMemo(() => {
    const map = new Map<string, number>()
    products?.forEach((p) => map.set(p.id, p.price))
    return map
  }, [products])

  return (
    <DocumentForm
      title="New sale"
      subtitle="Issue products or materials out of stock. This is the only way to reduce inventory."
      partyLabel="Customer"
      partyPlaceholder="Select a customer"
      partyOptions={(customers ?? []).map((c) => ({ value: c.id, label: c.company }))}
      amountLabel="Unit price"
      items={items ?? []}
      itemsLoading={itemsLoading}
      showOnHand
      defaultAmount={(item) =>
        item.kind === 'product' ? priceById.get(item.id) ?? item.avgCost : item.avgCost
      }
      submitLabel="Save sale"
      loading={isLoading}
      cancelTo="/sales/orders"
      onSubmit={async ({ date, partyId, lines }) => {
        const sale = await addSale({ date, customerId: partyId, lines }).unwrap()
        message.success(`Sale ${sale.reference} issued from stock.`)
        navigate('/sales/orders')
      }}
    />
  )
}

export default SaleFormPage
