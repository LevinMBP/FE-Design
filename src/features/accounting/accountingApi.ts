import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  addJournalEntry,
  getAccountLedger,
  getBalanceSheet,
  getIncomeStatement,
  getTrialBalance,
  listAccountBalances,
  listJournalEntries,
  saveOpeningBalances,
} from './mockAccounting'
import { recordAuditEvent } from '../admin/mockAuditLog'
import type {
  AccountBalance,
  AccountLedger,
  BalanceSheet,
  IncomeStatement,
  JournalEntry,
  NewJournalEntry,
  OpeningBalanceInput,
  TrialBalance,
} from './types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const accountingApi = createApi({
  reducerPath: 'accountingApi',
  baseQuery: fakeBaseQuery<string>(),
  // Ledgers and reports derive from both, so both tags gate their refetch.
  tagTypes: ['Account', 'JournalEntry'],
  endpoints: (builder) => ({
    getAccounts: builder.query<AccountBalance[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listAccountBalances() }
      },
      providesTags: ['Account', 'JournalEntry'],
    }),

    saveOpeningBalances: builder.mutation<AccountBalance[], OpeningBalanceInput[]>({
      queryFn: async (items) => {
        await delay(400)
        saveOpeningBalances(items)
        recordAuditEvent({ module: 'accounting', action: 'Saved opening balances' })
        return { data: listAccountBalances() }
      },
      invalidatesTags: ['Account'],
    }),

    getJournalEntries: builder.query<JournalEntry[], void>({
      queryFn: async () => {
        await delay(250)
        return { data: listJournalEntries() }
      },
      providesTags: ['JournalEntry'],
    }),

    addJournalEntry: builder.mutation<JournalEntry, NewJournalEntry>({
      queryFn: async (input) => {
        await delay(450)
        const result = addJournalEntry(input)
        if ('error' in result) return { error: result.error }
        recordAuditEvent({ module: 'accounting', action: 'Posted journal entry', target: result.reference })
        return { data: result }
      },
      invalidatesTags: ['JournalEntry'],
    }),

    getAccountLedger: builder.query<AccountLedger, string>({
      queryFn: async (accountId) => {
        await delay(250)
        const ledger = getAccountLedger(accountId)
        return ledger ? { data: ledger } : { error: 'Account not found.' }
      },
      providesTags: ['Account', 'JournalEntry'],
    }),

    getTrialBalance: builder.query<TrialBalance, void>({
      queryFn: async () => {
        await delay(250)
        return { data: getTrialBalance() }
      },
      providesTags: ['Account', 'JournalEntry'],
    }),

    getBalanceSheet: builder.query<BalanceSheet, void>({
      queryFn: async () => {
        await delay(250)
        return { data: getBalanceSheet() }
      },
      providesTags: ['Account', 'JournalEntry'],
    }),

    getIncomeStatement: builder.query<IncomeStatement, void>({
      queryFn: async () => {
        await delay(250)
        return { data: getIncomeStatement() }
      },
      providesTags: ['Account', 'JournalEntry'],
    }),
  }),
})

export const {
  useGetAccountsQuery,
  useSaveOpeningBalancesMutation,
  useGetJournalEntriesQuery,
  useAddJournalEntryMutation,
  useGetAccountLedgerQuery,
  useGetTrialBalanceQuery,
  useGetBalanceSheetQuery,
  useGetIncomeStatementQuery,
} = accountingApi
