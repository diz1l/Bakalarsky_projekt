import { baseApi } from '@/app/baseApi';
import type { Notification } from '@/types';

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<Notification[], void>({
      query: () => '/notifications',
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
    markRead: builder.mutation<Notification, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
    clearAllNotifications: builder.mutation<void, void>({
      query: () => ({ url: '/notifications', method: 'DELETE' }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const { useGetNotificationsQuery, useMarkReadMutation, useClearAllNotificationsMutation } = notificationsApi;
