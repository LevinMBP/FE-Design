import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  createPayRun,
  getPayRun,
  listCompensation,
  listPayRuns,
  markPayRunPaid,
  setCompensation,
} from './mockPayroll'
import { recordAuditEvent } from '../admin/mockAuditLog'
import type {
  CompensationRow,
  NewPayRunInput,
  PayRun,
  UpdateCompensationInput,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const payrollApi = createApi({
  reducerPath: 'payrollApi',
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ['PayRun', 'Compensation'],
  endpoints: (builder) => ({
    getCompensations: builder.query<CompensationRow[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listCompensation() }
      },
      providesTags: ['Compensation'],
    }),

    updateCompensation: builder.mutation<CompensationRow, UpdateCompensationInput>({
      queryFn: async (input) => {
        await delay(400)
        const result = setCompensation(input)
        if ('error' in result) return { error: result.error }
        recordAuditEvent({ module: 'payroll', action: 'Updated compensation', target: result.employeeName })
        return { data: result }
      },
      invalidatesTags: ['Compensation'],
    }),

    getPayRuns: builder.query<PayRun[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listPayRuns() }
      },
      providesTags: ['PayRun'],
    }),

    getPayRun: builder.query<PayRun, string>({
      queryFn: async (id) => {
        await delay(200)
        const run = getPayRun(id)
        return run ? { data: run } : { error: 'Pay run not found.' }
      },
      providesTags: (_result, _error, id) => [{ type: 'PayRun', id }],
    }),

    createPayRun: builder.mutation<PayRun, NewPayRunInput>({
      queryFn: async (input) => {
        await delay(500)
        const result = createPayRun(input)
        if ('error' in result) return { error: result.error }
        recordAuditEvent({ module: 'payroll', action: 'Created pay run', target: result.periodLabel })
        return { data: result }
      },
      invalidatesTags: ['PayRun'],
    }),

    markPayRunPaid: builder.mutation<PayRun, string>({
      queryFn: async (id) => {
        await delay(400)
        const run = markPayRunPaid(id)
        if (!run) return { error: 'Pay run not found.' }
        recordAuditEvent({ module: 'payroll', action: 'Marked pay run paid', target: run.periodLabel })
        return { data: run }
      },
      invalidatesTags: (_result, _error, id) => ['PayRun', { type: 'PayRun', id }],
    }),
  }),
})

export const {
  useGetCompensationsQuery,
  useUpdateCompensationMutation,
  useGetPayRunsQuery,
  useGetPayRunQuery,
  useCreatePayRunMutation,
  useMarkPayRunPaidMutation,
} = payrollApi
