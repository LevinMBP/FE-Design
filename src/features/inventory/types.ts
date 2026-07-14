export interface Material {
  id: string
  name: string
  sku: string
  unit: string
  quantity: number
  unitCost: number
  minStock: number
  maxStock: number
  packaging: string
  description: string
  /** Opening FIFO cost layers; when set, on-hand = Σ lot quantities. */
  openingLots?: OpeningLot[]
}

/**
 * One opening-stock cost layer: a FIFO batch already on hand at go-live.
 * Ordered oldest-first, so FIFO issues them in list order. Optional — when
 * absent, the item's single quantity/cost seeds one blended opening lot.
 */
export interface OpeningLot {
  quantity: number
  unitCost: number
}

/* ------------------------------------------------------------------ *
 * Locations — warehouses and storage places stock lives in.            *
 * ------------------------------------------------------------------ */

export type LocationType = 'warehouse' | 'store' | 'production' | 'transit'

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  warehouse: 'Warehouse',
  store: 'Store',
  production: 'Production',
  transit: 'In Transit',
}

export const LOCATION_TYPE_OPTIONS = (
  Object.keys(LOCATION_TYPE_LABELS) as LocationType[]
).map((t) => ({ value: t, label: LOCATION_TYPE_LABELS[t] }))

export type LocationStatus = 'active' | 'inactive'

export interface InventoryLocation {
  id: string
  name: string
  code: string
  type: LocationType
  address: string
  description: string
  status: LocationStatus
}

export interface NewLocation {
  name: string
  code: string
  type: LocationType
  address: string
  description: string
  status: LocationStatus
}

export type ProductType = 'imported' | 'local_purchase' | 'manufactured'

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  imported: 'Imported',
  local_purchase: 'Local Purchase',
  manufactured: 'Manufactured',
}

/** One material line of a product's bill of materials (per output unit). */
export interface RecipeLine {
  materialId: string
  quantityPerUnit: number
}

export interface Product {
  id: string
  name: string
  sku: string
  type: ProductType
  quantity: number
  price: number
  packaging: string
  /** Bill of materials — only meaningful for manufactured products. */
  recipe?: RecipeLine[]
  /** Opening FIFO cost layers; when set, on-hand = Σ lot quantities. */
  openingLots?: OpeningLot[]
}

export interface NewMaterial {
  name: string
  sku: string
  unit: string
  minStock: number
  maxStock: number
  packaging: string
  description: string
}

export interface NewProduct {
  name: string
  sku: string
  type: ProductType
  price: number
  packaging: string
  /** Required for manufactured products; omitted otherwise. */
  recipe?: RecipeLine[]
}

/** One item's opening FIFO cost layers, as posted from the Opening Balance document. */
export interface OpeningBalanceLine {
  kind: StockItemKind
  itemId: string
  lots: OpeningLot[]
}

/** An Opening Balance document: opening stock for one or more items at go-live. */
export interface NewOpeningBalance {
  date: string
  location: string
  lines: OpeningBalanceLine[]
}

/** Result of posting an Opening Balance document. */
export interface OpeningBalanceResult {
  itemsPosted: number
  totalValue: number
}

/* ------------------------------------------------------------------ *
 * Stock ledger — "running inventory" (in/out movements + balance).     *
 * ------------------------------------------------------------------ */

export type StockItemKind = 'material' | 'product'
export type MovementDirection = 'in' | 'out'
export type StockStatus = 'ok' | 'low' | 'out'

/** A product or material summarised for the stock overview. */
export interface StockItem {
  id: string
  kind: StockItemKind
  name: string
  sku: string
  unit: string
  onHand: number
  status: StockStatus
  avgCost: number // FIFO-weighted cost of the remaining on-hand
  stockValue: number // onHand valued at its remaining FIFO lots
}

/** A single in/out movement against one item. */
export interface StockMovement {
  id: string
  itemId: string
  itemKind: StockItemKind
  date: string // ISO date (YYYY-MM-DD)
  source: string // Opening Balance | Purchase | Sale | Manufacturing | Adjustment
  reference: string
  location: string
  direction: MovementDirection
  quantity: number // magnitude, always > 0 (0 for the opening row)
  // For an "in" this is the receipt (lot) cost; for an "out" it's the
  // FIFO-weighted cost of the lots consumed by that issue.
  unitCost: number
}

/** State of one FIFO lot as of a point in the ledger. */
export interface LedgerLotSnapshot {
  reference: string // the receipt (PB-…) that created this lot
  date: string
  originalQty: number // quantity received into the lot
  left: number // quantity still remaining in the lot
  unitCost: number
}

/** A movement enriched with its running FIFO position for display. */
export interface LedgerRow extends StockMovement {
  txnNo: number
  balance: number // total on-hand quantity after this movement
  value: number // movement value: quantity * unitCost
  stockValue: number // total FIFO value of on-hand after this movement
  lots: LedgerLotSnapshot[] // per-lot remaining ("Left") after this movement
  opening?: boolean
}

/** A remaining FIFO cost layer (an un-consumed slice of a receipt). */
export interface FifoLayer {
  date: string
  reference: string
  quantity: number
  unitCost: number
  value: number
}

/** An item plus its full computed ledger and remaining FIFO layers. */
export interface ItemLedger {
  item: StockItem
  rows: LedgerRow[]
  layers: FifoLayer[]
  stockValue: number
  avgCost: number
}

/** One material consumed by a manufacturing run. */
export interface ManufactureLine {
  materialId: string
  quantity: number
}

export interface ManufactureRequest {
  productId: string
  outputQuantity: number
  lines: ManufactureLine[]
}

/** A consumed material within a recorded production run, with its FIFO cost. */
export interface ManufactureRunLine {
  materialId: string
  materialName: string
  unit: string
  quantity: number
  unitCost: number // FIFO avg cost of the material at run time
  cost: number // quantity * unitCost
}

/** A recorded manufacturing run for the production history. */
export interface ManufactureRun {
  id: string
  date: string // ISO timestamp
  productId: string
  productName: string
  outputQuantity: number
  lines: ManufactureRunLine[]
  materialCost: number // total FIFO cost of materials consumed
  unitCost: number // materialCost / outputQuantity
}

/** Result of a manufacture mutation: the updated product + the logged run. */
export interface ManufactureResult {
  product: Product
  run: ManufactureRun
}

/* ------------------------------------------------------------------ *
 * Purchases (stock IN) & Sales (stock OUT) — the only external ways    *
 * to change on-hand inventory.                                         *
 * ------------------------------------------------------------------ */

/**
 * What kind of purchase this is. Material/Product receive stock; Asset, Service
 * and Expense do not (they're recorded as a bill for accounting only). The type
 * also determines which account is debited (see PURCHASE_DEBIT_ACCOUNT).
 */
export type PurchaseType = 'material' | 'product' | 'asset' | 'service' | 'expense'

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  material: 'Material',
  product: 'Product',
  asset: 'Asset',
  service: 'Service',
  expense: 'Expense',
}

/** Purchase types that add to inventory (and only these). */
export const PURCHASE_STOCK_TYPES: PurchaseType[] = ['material', 'product']

export function purchaseAddsStock(type: PurchaseType): boolean {
  return PURCHASE_STOCK_TYPES.includes(type)
}

/** One tax applied to a purchase line, with its computed amount on that line. */
export interface PurchaseLineTax {
  taxId: string
  label: string // e.g. "VAT 12%"
  rate: number
  amount: number // tax on this line (lineSubtotal × rate)
}

/**
 * One line of a purchase. Each line carries its own `type`: material/product
 * lines receive stock into a `location`; asset/service/expense lines use
 * `itemName` as a free-text description and touch no inventory. A line may carry
 * multiple added-on taxes (input VAT etc.).
 */
export interface PurchaseLine {
  type: PurchaseType
  itemKind?: StockItemKind
  itemId?: string
  itemName: string
  unit: string
  locationId?: string // where stock is received (stock lines only)
  locationName?: string
  quantity: number
  unitCost: number
  lineSubtotal: number // quantity × unitCost
  taxes: PurchaseLineTax[]
  taxAmount: number // Σ line taxes
  lineTotal: number // lineSubtotal + taxAmount
}

/** A tax rolled up across all lines, for the document totals. */
export interface PurchaseTaxSummary {
  taxId: string
  label: string
  rate: number
  amount: number
}

export interface Purchase {
  id: string
  reference: string // PO-001, … (editable at entry)
  date: string // ISO date
  dueDate: string // payment term / due date (ISO)
  vendorId: string
  vendorName: string
  note: string
  lines: PurchaseLine[]
  subtotal: number // goods/services value (also the amount capitalised/expensed)
  taxAmount: number // Σ added-on taxes across lines
  taxSummary: PurchaseTaxSummary[] // taxes grouped for the totals display
  total: number // subtotal + taxAmount
  netPayable: number // = total (what the vendor is paid); kept for payment logic
  amountPaid: number // running total settled via vendor payments (0 until paid)
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

/** Where a purchase stands on settlement, derived from its payable vs paid. */
export function purchasePaymentStatus(p: {
  netPayable: number
  amountPaid: number
}): PaymentStatus {
  if (p.amountPaid <= 0.005) return 'unpaid'
  if (p.amountPaid + 0.005 >= p.netPayable) return 'paid'
  return 'partial'
}

/** A recorded payment settling (part of) a purchase's payable. */
export interface Payment {
  id: string
  reference: string // PMT-001
  date: string
  purchaseId: string
  purchaseRef: string
  vendorId: string
  vendorName: string
  paymentMethodId: string
  paymentMethodName: string
  amount: number
}

export interface NewVendorPayment {
  purchaseId: string
  paymentMethodId: string
  date: string
  amount: number
}

/** One line of a sale: an item issued at a given unit price. */
export interface SaleLine {
  itemKind: StockItemKind
  itemId: string
  itemName: string
  unit: string
  quantity: number
  unitPrice: number
}

export interface Sale {
  id: string
  reference: string // SO-001, …
  date: string // ISO date
  customerId: string
  customerName: string
  lines: SaleLine[]
  total: number
}

/** A document line as submitted from a form (names/units resolved server-side). */
export interface DocumentLineInput {
  itemKind: StockItemKind
  itemId: string
  quantity: number
  amount: number // unit cost (purchase) or unit price (sale)
}

/**
 * A purchase line as submitted. Each line has its own `type`; stock lines carry
 * item refs and a `locationId`, others a free-text `description`. `taxIds` are
 * the added-on taxes selected for the line.
 */
export interface PurchaseLineInput {
  type: PurchaseType
  itemKind?: StockItemKind
  itemId?: string
  description?: string
  locationId?: string
  quantity: number
  amount: number // unit cost
  taxIds: string[]
}

export interface NewPurchase {
  reference: string // PO#, editable (blank = auto-assign)
  date: string
  dueDate: string
  vendorId: string
  note: string
  lines: PurchaseLineInput[]
}

export interface NewSale {
  date: string
  customerId: string
  lines: DocumentLineInput[]
}

/* ------------------------------------------------------------------ *
 * Audits & Adjustments.                                                *
 *                                                                      *
 * An AUDIT is a physical stock count: it snapshots each item's system  *
 * on-hand, records the counted quantity, and computes the variance —   *
 * it NEVER changes stock. An ADJUSTMENT is what actually moves on-hand *
 * (up or down) and posts to the books. The two are separate documents: *
 * you can audit without adjusting, and you can adjust without auditing. *
 * An adjustment may be "fast-tracked" from an audit to reconcile its   *
 * variances, which links the two and marks the audit as adjusted.      *
 * ------------------------------------------------------------------ */

/** Why an adjustment was made — drives nothing in the books but records intent. */
export type AdjustmentReason =
  | 'damage'
  | 'shrinkage'
  | 'count_correction'
  | 'return_to_supplier'
  | 'production_correction'
  | 'other'

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  damage: 'Damage',
  shrinkage: 'Shrinkage',
  count_correction: 'Stock Count Correction',
  return_to_supplier: 'Return to Supplier',
  production_correction: 'Production Correction',
  other: 'Other',
}

export const ADJUSTMENT_REASON_OPTIONS = (
  Object.keys(ADJUSTMENT_REASON_LABELS) as AdjustmentReason[]
).map((r) => ({ value: r, label: ADJUSTMENT_REASON_LABELS[r] }))

/**
 * Where an audit stands:
 *  - balanced: every counted qty matched the system (nothing to reconcile)
 *  - open:     has variances, no adjustment posted yet
 *  - adjusted: an adjustment was fast-tracked from it to reconcile
 */
export type AuditStatus = 'balanced' | 'open' | 'adjusted'

/** One counted item within an audit (system on-hand snapshotted at count time). */
export interface AuditLine {
  kind: StockItemKind
  itemId: string
  itemName: string
  unit: string
  systemQty: number // on-hand at the moment the audit was recorded
  countedQty: number
  variance: number // countedQty − systemQty (positive = surplus, negative = short)
}

/** A recorded stock count. Read-only against inventory — it moves nothing. */
export interface Audit {
  id: string
  reference: string // AUD-001
  date: string
  /** What the whole document counts — every line is this kind of item. */
  itemType: StockItemKind
  locationId: string
  location: string // resolved location name, for display
  note: string
  lines: AuditLine[]
  status: AuditStatus
  adjustmentId?: string // set once an adjustment is fast-tracked from it
  adjustmentRef?: string
}

/** Lines carry only the item id — their kind is the document's `itemType`. */
export interface NewAuditLine {
  itemId: string
  countedQty: number
}

export interface NewAudit {
  date: string
  itemType: StockItemKind
  locationId: string
  note: string
  lines: NewAuditLine[]
}

/** One item's on-hand change within an adjustment, with its costed value. */
export interface AdjustmentLine {
  kind: StockItemKind
  itemId: string
  itemName: string
  unit: string
  previousQty: number // on-hand before the adjustment
  countedQty: number // target on-hand after the adjustment
  delta: number // countedQty − previousQty (signed; the stock movement)
  unitCost: number // in → cost the new lot enters at; out → FIFO cost consumed
  value: number // signed inventory value change (delta direction)
}

/** A posted stock adjustment: changes on-hand and books the offset. */
export interface Adjustment {
  id: string
  reference: string // ADJ-001
  date: string
  /** What the whole document adjusts — every line is this kind of item. */
  itemType: StockItemKind
  locationId: string
  location: string // resolved location name, for display
  reason: AdjustmentReason
  otherReason?: string // free text, required when reason is 'other'
  note: string
  auditId?: string // set when fast-tracked from an audit
  auditRef?: string
  lines: AdjustmentLine[]
  inValue: number // total value added (increases)
  outValue: number // total value removed (decreases)
  netValue: number // inValue − outValue (signed change to the Inventory account)
}

/**
 * Lines carry only the item id — their kind is the document's `itemType`.
 * `delta` is the signed quantity change (addition > 0, deduction < 0); the
 * backend applies it against the current on-hand.
 */
export interface NewAdjustmentLine {
  itemId: string
  delta: number
}

export interface NewAdjustment {
  date: string
  itemType: StockItemKind
  locationId: string
  reason: AdjustmentReason
  otherReason?: string
  note: string
  auditId?: string
  lines: NewAdjustmentLine[]
}
