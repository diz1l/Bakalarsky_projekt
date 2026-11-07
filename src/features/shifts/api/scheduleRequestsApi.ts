import { baseApi } from '@/app/baseApi';
import type { AbsenceType, ScheduleRequest } from '@/types';

export const scheduleRequestsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getScheduleRequests: builder.query<ScheduleRequest[], { from: string; to: string }>({
      query: ({ from, to }) => `/schedule-requests?from=${from}&to=${to}`,
      providesTags: [{ type: 'ScheduleRequest', id: 'LIST' }],
    }),
    createScheduleRequest: builder.mutation<ScheduleRequest, { date: string; type: AbsenceType }>({
      query: (body) => ({ url: '/schedule-requests', method: 'POST', body }),
      invalidatesTags: [{ type: 'ScheduleRequest', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    reviewScheduleRequest: builder.mutation<ScheduleRequest, { id: string; decision: 'APPROVED' | 'REJECTED' }>({
      query: ({ id, decision }) => ({ url: `/schedule-requests/${id}/review`, method: 'PUT', body: { decision } }),
      invalidatesTags: [{ type: 'ScheduleRequest', id: 'LIST' }, { type: 'Absence', id: 'LIST' }, { type: 'Shift', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const { useGetScheduleRequestsQuery, useCreateScheduleRequestMutation, useReviewScheduleRequestMutation } = scheduleRequestsApi;
