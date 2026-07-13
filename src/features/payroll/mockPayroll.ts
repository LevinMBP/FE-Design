import { listEmployees } from '../contacts/mockContacts'
import type { Employee } from '../contacts/types'
import type {
  CompensationRow,
  EmployeeCompensation,
  NewPayRunInput,
  PayRun,
  Payslip,
  PayslipDeductions,
  UpdateCompensationInput,
} from './types'

/**
 * In-memory mock payroll "database", mirroring the other feature mocks.
 * Compensation is seeded per employee id; unknown employees fall back to a
 * position-based default so a pay run can always be generated. Replace with
 * real HTTP later without touching the components.
 */

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`
const round2 = (n: number) => Math.round(n * 100) / 100

/** Seeded monthly compensation, keyed by the contacts mock employee ids. */
const compensation: Record<string, EmployeeCompensation> = {
  emp_gab: { employeeId: 'emp_gab', basicPay: 32000, allowance: 2000 },
  emp_hana: { employeeId: 'emp_hana', basicPay: 45000, allowance: 3000 },
  emp_ivan: { employeeId: 'emp_ivan', basicPay: 38000, allowance: 2500 },
}

/** Fallback compensation for employees without a seeded/saved record. */
function defaultCompensation(employeeId: string): EmployeeCompensation {
  return { employeeId, basicPay: 25000, allowance: 2000 }
}

export function getCompensation(employee: Employee): EmployeeCompensation {
  return compensation[employee.id] ?? defaultCompensation(employee.id)
}

function toRow(employee: Employee): CompensationRow {
  const comp = getCompensation(employee)
  return {
    employeeId: employee.id,
    basicPay: comp.basicPay,
    allowance: comp.allowance,
    employeeName: employee.name,
    position: employee.position,
    department: employee.department,
    grossPay: round2(comp.basicPay + comp.allowance),
  }
}

/** All active employees joined with their (seeded, saved, or default) comp. */
export function listCompensation(): CompensationRow[] {
  return listEmployees()
    .filter((e) => e.status === 'active')
    .map(toRow)
}

export function setCompensation(
  input: UpdateCompensationInput,
): CompensationRow | { error: string } {
  const employee = listEmployees().find((e) => e.id === input.employeeId)
  if (!employee) return { error: 'Employee not found.' }
  compensation[input.employeeId] = {
    employeeId: input.employeeId,
    basicPay: input.basicPay,
    allowance: input.allowance,
  }
  return toRow(employee)
}

/**
 * Simplified PH statutory deductions on monthly basic pay. Rates are
 * illustrative — enough to make payslips add up realistically for the demo.
 */
export function computeDeductions(basicPay: number): PayslipDeductions {
  const sss = round2(basicPay * 0.045)
  const philhealth = round2(basicPay * 0.02)
  const pagibig = Math.min(round2(basicPay * 0.02), 100)
  const taxable = basicPay - sss - philhealth - pagibig
  // Flat 15% on the portion above the ~250k/yr (≈20,833/mo) exemption.
  const tax = taxable > 20833 ? round2((taxable - 20833) * 0.15) : 0
  return { sss, philhealth, pagibig, tax }
}

function buildPayslip(employee: Employee): Payslip {
  const comp = getCompensation(employee)
  const grossPay = round2(comp.basicPay + comp.allowance)
  const deductions = computeDeductions(comp.basicPay)
  const totalDeductions = round2(
    deductions.sss + deductions.philhealth + deductions.pagibig + deductions.tax,
  )
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    position: employee.position,
    basicPay: comp.basicPay,
    allowance: comp.allowance,
    grossPay,
    deductions,
    totalDeductions,
    netPay: round2(grossPay - totalDeductions),
  }
}

let payRuns: PayRun[] = []

export function listPayRuns(): PayRun[] {
  return [...payRuns]
}

export function getPayRun(id: string): PayRun | undefined {
  return payRuns.find((r) => r.id === id)
}

/** Generate a pay run for all active employees. Rejects a duplicate period. */
export function createPayRun(input: NewPayRunInput): PayRun | { error: string } {
  if (payRuns.some((r) => r.period === input.period)) {
    return { error: `A pay run for ${input.periodLabel} already exists.` }
  }

  const employees = listEmployees().filter((e) => e.status === 'active')
  const payslips = employees.map(buildPayslip)

  const totalGross = round2(payslips.reduce((s, p) => s + p.grossPay, 0))
  const totalDeductions = round2(
    payslips.reduce((s, p) => s + p.totalDeductions, 0),
  )
  const totalNet = round2(payslips.reduce((s, p) => s + p.netPay, 0))

  const record: PayRun = {
    id: uid('run'),
    period: input.period,
    periodLabel: input.periodLabel,
    payDate: input.payDate,
    status: 'draft',
    payslips,
    headcount: payslips.length,
    totalGross,
    totalDeductions,
    totalNet,
    createdAt: new Date().toISOString(),
  }
  payRuns = [record, ...payRuns]
  return record
}

export function markPayRunPaid(id: string): PayRun | undefined {
  const run = payRuns.find((r) => r.id === id)
  if (!run) return undefined
  run.status = 'paid'
  return { ...run }
}
