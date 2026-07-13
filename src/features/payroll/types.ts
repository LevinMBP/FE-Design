export type PayRunStatus = 'draft' | 'paid'

/** Monthly compensation for an employee, used to generate payslips. */
export interface EmployeeCompensation {
  employeeId: string
  basicPay: number
  allowance: number
}

/** A compensation record joined with the employee's display details. */
export interface CompensationRow extends EmployeeCompensation {
  employeeName: string
  position: string
  department: string
  grossPay: number
}

export interface UpdateCompensationInput {
  employeeId: string
  basicPay: number
  allowance: number
}

/** Statutory deduction breakdown on a payslip (PH-style, simplified). */
export interface PayslipDeductions {
  sss: number
  philhealth: number
  pagibig: number
  tax: number
}

export interface Payslip {
  employeeId: string
  employeeName: string
  position: string
  basicPay: number
  allowance: number
  grossPay: number
  deductions: PayslipDeductions
  totalDeductions: number
  netPay: number
}

export interface PayRun {
  id: string
  /** 'YYYY-MM' period key. */
  period: string
  /** Human label, e.g. "July 2026". */
  periodLabel: string
  /** ISO date the run is paid out. */
  payDate: string
  status: PayRunStatus
  payslips: Payslip[]
  headcount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  createdAt: string
}

export interface NewPayRunInput {
  period: string
  payDate: string
  periodLabel: string
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

export function formatPeso(value: number): string {
  return peso.format(value)
}
