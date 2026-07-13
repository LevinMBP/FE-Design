import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'

export interface AppNotification {
  id: string
  title: string
  time: string
  read: boolean
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mockNotifications: AppNotification[] = [
  {
    id: 'n1',
    title: 'Low stock: Steel Bolts (M8) fell below the reorder point.',
    time: '2h ago',
    read: false,
  },
  {
    id: 'n2',
    title: 'Purchase order PO-1042 was approved.',
    time: '5h ago',
    read: false,
  },
  {
    id: 'n3',
    title: 'Ava added 3 new products to Inventory.',
    time: 'Yesterday',
    read: false,
  },
  {
    id: 'n4',
    title: 'Monthly inventory audit completed.',
    time: '2d ago',
    read: true,
  },
]

/**
 * Mock notifications feed. Swap `fakeBaseQuery` + queryFn for a real endpoint
 * later; the `useGetNotificationsQuery` hook stays the same.
 */
export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: fakeBaseQuery<string>(),
  endpoints: (builder) => ({
    getNotifications: builder.query<AppNotification[], void>({
      queryFn: async () => {
        await delay(300)
        return { data: mockNotifications }
      },
    }),
  }),
})

export const { useGetNotificationsQuery } = notificationsApi
