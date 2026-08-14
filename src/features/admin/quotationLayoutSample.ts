import dayjs from 'dayjs'
import type { QuotationDoc } from '../sales/quotations/QuotationDocument'

/**
 * Sample quotations used only by the layout editor's live preview. Two sizes so
 * a client can check both a short quote (does the page look empty?) and a long
 * one (do the columns still fit?) before saving a layout.
 */

const today = () => dayjs().format('YYYY-MM-DD')

const BASE: Omit<QuotationDoc, 'lines' | 'subtotal' | 'taxBreakdown' | 'total'> = {
  reference: 'QUO-0142',
  status: 'sent',
  customerName: 'Acme Trading Corp.',
  contactPerson: 'Jorge Santos',
  email: 'purchasing@acme.example',
  address: '88 Industria St, Pasig City',
  date: today(),
  effectiveDate: today(),
  expiryDate: dayjs().add(3, 'month').format('YYYY-MM-DD'),
  discountAmount: 0,
  notes: 'Prices valid for 30 days. 50% down payment required to begin.',
  preparedBy: { name: 'Ava Reyes', signature: '' },
  approvedBy: { name: 'Marcus Lee', signature: '' },
}

const SHORT_LINES: QuotationDoc['lines'] = [
  {
    itemKind: 'material',
    itemId: 's1',
    itemName: 'Steel Bolts (M8)',
    packaging: 'Box of 100',
    description: 'Zinc-plated, DIN 933 hex head',
    quantity: 20,
    unit: 'box',
    unitPrice: 45,
  },
  {
    itemKind: 'material',
    itemId: 's2',
    itemName: 'Aluminum Sheet 2mm',
    packaging: 'Sheet',
    description:
      'Mill-finish 1220×2440mm aluminium sheet, alloy 5052-H32, protective film both sides, cut to size on request — a deliberately long line to show how descriptions wrap within the page.',
    quantity: 5,
    unit: 'sheet',
    unitPrice: 1200,
  },
  {
    itemKind: 'product',
    itemId: 's3',
    itemName: 'On-site Assembly',
    packaging: '',
    description: 'Assembly and calibration at the customer site',
    quantity: 1,
    unit: 'job',
    unitPrice: 3000,
  },
]

const EXTRA_LINES: QuotationDoc['lines'] = [
  {
    itemKind: 'material',
    itemId: 's4',
    itemName: 'Hex Nuts (M8)',
    packaging: 'Box of 200',
    description: 'Zinc-plated, DIN 934',
    quantity: 12,
    unit: 'box',
    unitPrice: 38,
  },
  {
    itemKind: 'material',
    itemId: 's5',
    itemName: 'Flat Washers (M8)',
    packaging: 'Bag of 500',
    description: 'Stainless A2',
    quantity: 8,
    unit: 'bag',
    unitPrice: 62,
  },
  {
    itemKind: 'material',
    itemId: 's6',
    itemName: 'Mild Steel Angle Bar',
    packaging: '6m length',
    description: '50 × 50 × 5mm, hot-rolled',
    quantity: 30,
    unit: 'pc',
    unitPrice: 780,
  },
  {
    itemKind: 'material',
    itemId: 's7',
    itemName: 'Welding Rod E6013',
    packaging: 'Box of 5kg',
    description: '2.5mm general purpose',
    quantity: 15,
    unit: 'box',
    unitPrice: 410,
  },
  {
    itemKind: 'product',
    itemId: 's8',
    itemName: 'Powder Coating',
    packaging: '',
    description: 'RAL 7016, matte finish, per square metre',
    quantity: 46,
    unit: 'sqm',
    unitPrice: 320,
  },
  {
    itemKind: 'product',
    itemId: 's9',
    itemName: 'Delivery — Metro Manila',
    packaging: '',
    description: 'One truckload, ground floor unloading',
    quantity: 2,
    unit: 'trip',
    unitPrice: 2500,
  },
]

/** Sum the lines and add a 12% VAT row so the totals block looks realistic. */
function withTotals(lines: QuotationDoc['lines']): QuotationDoc {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const vat = Math.round(subtotal * 0.12 * 100) / 100
  return {
    ...BASE,
    lines,
    subtotal,
    taxBreakdown: [{ label: 'VAT 12%', amount: vat }],
    total: subtotal + vat,
  }
}

export const SAMPLE_SHORT = withTotals(SHORT_LINES)
export const SAMPLE_LONG = withTotals([...SHORT_LINES, ...EXTRA_LINES])
