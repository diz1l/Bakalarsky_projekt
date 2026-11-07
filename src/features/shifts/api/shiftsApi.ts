import { baseApi } from '@/app/baseApi';
import type { Shift } from '@/types';

export const shiftsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getShifts: builder.query<Shift[], { weekStart: string; endDate?: string }>({
      query: ({ weekStart, endDate }) => `/shifts?weekStart=${weekStart}${endDate ? `&endDate=${endDate}` : ''}`,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Shift' as const, id })), { type: 'Shift', id: 'LIST' }]
          : [{ type: 'Shift', id: 'LIST' }],
    }),
    createShift: builder.mutation<Shift, Omit<Shift, 'id'>>({
      query: (body) => ({ url: '/shifts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Shift', id: 'LIST' }, { type: 'Absence', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    updateShift: builder.mutation<Shift, Shift>({
      query: ({ id, ...body }) => ({ url: `/shifts/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Shift', id },
        { type: 'Shift', id: 'LIST' },
        { type: 'Notification', id: 'LIST' },
      ],
    }),
    deleteShift: builder.mutation<void, string>({
      query: (id) => ({ url: `/shifts/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Shift', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetShiftsQuery,
  useCreateShiftMutation,
  useUpdateShiftMutation,
  useDeleteShiftMutation,
} = shiftsApi;
