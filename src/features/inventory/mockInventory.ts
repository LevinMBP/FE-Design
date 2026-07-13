import type {
  ManufactureRequest,
  Material,
  NewMaterial,
  NewProduct,
  Product,
  StockItemKind,
} from './types'

/**
 * In-memory mock inventory "database". Mutations here stand in for a backend;
 * the inventoryApi endpoints call these and invalidate RTK Query tags so lists
 * refetch. Replace with real HTTP later without touching the components.
 */

const uid = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().slice(0, 8)}`

let materials: Material[] = [
  { id: 'mat_steel', name: 'Steel Sheet', sku: 'MAT-STL', unit: 'kg', quantity: 500, unitCost: 12, minStock: 100, maxStock: 1000, packaging: 'Bundle', description: 'Cold-rolled steel sheet.' },
  { id: 'mat_bolt', name: 'Steel Bolt M8', sku: 'MAT-BLT8', unit: 'pc', quantity: 40, unitCost: 0.2, minStock: 100, maxStock: 800, packaging: 'Box of 100', description: 'M8 hex bolt.' },
  { id: 'mat_wood', name: 'Wood Plank', sku: 'MAT-WPL', unit: 'pc', quantity: 300, unitCost: 5, minStock: 80, maxStock: 600, packaging: 'Pallet', description: 'Pine wood plank.' },
  { id: 'mat_paint', name: 'Paint (White)', sku: 'MAT-PNT', unit: 'L', quantity: 80, unitCost: 8, minStock: 20, maxStock: 200, packaging: 'Can', description: 'White enamel paint.' },
]

let products: Product[] = [
  { id: 'prd_cabinet', name: 'Steel Cabinet', sku: 'PRD-CAB', type: 'manufactured', quantity: 15, price: 220, packaging: 'Crate', recipe: [{ materialId: 'mat_steel', quantityPerUnit: 2 }, { materialId: 'mat_bolt', quantityPerUnit: 8 }] },
  { id: 'prd_table', name: 'Wooden Table', sku: 'PRD-TBL', type: 'manufactured', quantity: 8, price: 140, packaging: 'Flat-pack carton', recipe: [{ materialId: 'mat_wood', quantityPerUnit: 4 }, { materialId: 'mat_bolt', quantityPerUnit: 12 }, { materialId: 'mat_paint', quantityPerUnit: 1 }] },
  { id: 'prd_drill', name: 'Imported Drill', sku: 'PRD-DRL', type: 'imported', quantity: 30, price: 90, packaging: 'Box' },
  { id: 'prd_hinges', name: 'Local Hinges', sku: 'PRD-HNG', type: 'local_purchase', quantity: 200, price: 3, packaging: 'Pack of 10' },
]

export function listMaterials(): Material[] {
  return [...materials]
}

export function listProducts(): Product[] {
  return [...products]
}

export function addMaterial(input: NewMaterial): Material {
  // New items always start at 0 on hand — stock only enters via an Opening
  // Balance document or a purchase, never typed on the item itself.
  const material: Material = { id: uid('mat'), ...input, quantity: 0, unitCost: 0 }
  materials = [material, ...materials]
  return material
}

export function addProduct(input: NewProduct): Product {
  const product: Product = { id: uid('prd'), ...input, quantity: 0 }
  products = [product, ...products]
  return product
}

/** Minimal item reference used by purchase/sale line handling. */
export interface StockItemRef {
  id: string
  name: string
  unit: string
  quantity: number
}

export function getStockItemRef(
  kind: StockItemKind,
  id: string,
): StockItemRef | undefined {
  if (kind === 'material') {
    const m = materials.find((x) => x.id === id)
    return m ? { id: m.id, name: m.name, unit: m.unit, quantity: m.quantity } : undefined
  }
  const p = products.find((x) => x.id === id)
  return p ? { id: p.id, name: p.name, unit: 'ea', quantity: p.quantity } : undefined
}

/** Increment on-hand for an item (purchases receive stock; manufacturing outputs). */
export function addStock(kind: StockItemKind, id: string, qty: number): void {
  if (kind === 'material') {
    materials = materials.map((m) =>
      m.id === id ? { ...m, quantity: m.quantity + qty } : m,
    )
  } else {
    products = products.map((p) =>
      p.id === id ? { ...p, quantity: p.quantity + qty } : p,
    )
  }
}

/** Decrement on-hand; throws if there isn't enough (sales; manufacturing inputs). */
export function removeStock(kind: StockItemKind, id: string, qty: number): void {
  const ref = getStockItemRef(kind, id)
  if (!ref) throw new Error('A selected item no longer exists.')
  if (ref.quantity < qty) {
    throw new Error(
      `Not enough ${ref.name}: have ${ref.quantity} ${ref.unit}, need ${qty}.`,
    )
  }
  addStock(kind, id, -qty)
}

/**
 * Consume materials to produce units of a manufactured product.
 * Validates stock up front, then applies the deductions and increments the
 * product quantity. Throws with a user-facing message on any problem.
 */
export function manufacture(req: ManufactureRequest): Product {
  const product = products.find((p) => p.id === req.productId)
  if (!product) throw new Error('Select a product to produce.')
  if (product.type !== 'manufactured') {
    throw new Error('Only manufactured products can be produced.')
  }
  if (req.outputQuantity <= 0) {
    throw new Error('Output quantity must be greater than 0.')
  }
  const usableLines = req.lines.filter((l) => l.materialId && l.quantity > 0)
  if (usableLines.length === 0) {
    throw new Error('Add at least one material with a quantity.')
  }

  // Validate availability before mutating anything.
  for (const line of usableLines) {
    const material = materials.find((m) => m.id === line.materialId)
    if (!material) throw new Error('A selected material no longer exists.')
    if (material.quantity < line.quantity) {
      throw new Error(
        `Not enough ${material.name}: have ${material.quantity} ${material.unit}, need ${line.quantity}.`,
      )
    }
  }

  materials = materials.map((m) => {
    const line = usableLines.find((l) => l.materialId === m.id)
    return line ? { ...m, quantity: m.quantity - line.quantity } : m
  })
  products = products.map((p) =>
    p.id === product.id ? { ...p, quantity: p.quantity + req.outputQuantity } : p,
  )

  return products.find((p) => p.id === product.id)!
}
