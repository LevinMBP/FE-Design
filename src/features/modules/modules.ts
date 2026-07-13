import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  Wallet,
  ShoppingCart,
  Tags,
  Calculator,
} from 'lucide-react'

export type ModuleId =
  | 'inventory'
  | 'finance'
  | 'purchases'
  | 'sales'
  | 'accounting'

export type ModuleAccent =
  | 'brand'
  | 'green'
  | 'amber'
  | 'violet'
  | 'sky'
  | 'rose'
  | 'emerald'

export interface ModuleMeta {
  id: ModuleId
  name: string
  description: string
  icon: LucideIcon
  accent: ModuleAccent
  /** Whether the module has real content yet (vs. a coming-soon placeholder). */
  ready: boolean
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'purchases',
    name: 'Purchases',
    description: 'Receive products and materials into stock.',
    icon: ShoppingCart,
    accent: 'sky',
    ready: true,
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description:
      'Products, materials, stock movements, audits and manufacturing.',
    icon: Boxes,
    accent: 'brand',
    ready: true,
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Issue products and materials out of stock.',
    icon: Tags,
    accent: 'rose',
    ready: true,
  },
  {
    id: 'finance',
    name: 'Finance & Payroll',
    description: 'Taxes, payment methods, employees, compensation and pay runs.',
    icon: Wallet,
    accent: 'amber',
    ready: true,
  },
  {
    id: 'accounting',
    name: 'Accounting',
    description: 'Journal entries, ledgers and financial statements.',
    icon: Calculator,
    accent: 'emerald',
    ready: true,
  },
]

export function getModule(id: ModuleId): ModuleMeta {
  const found = MODULES.find((m) => m.id === id)
  if (!found) throw new Error(`Unknown module: ${id}`)
  return found
}
