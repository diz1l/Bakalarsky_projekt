import { baseApi } from '@/app/baseApi';
import type { Absence } from '@/types';

export const absencesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAbsences: builder.query<Absence[], { from: string; to: string }>({
      query: ({ from, to }) => `/absences?from=${from}&to=${to}`,
      providesTags: [{ type: 'Absence', id: 'LIST' }],
    }),
    saveAbsence: builder.mutation<Absence, Omit<Absence, 'id'>>({
      query: (body) => ({ url: '/absences', method: 'PUT', body }),
      invalidatesTags: [{ type: 'Absence', id: 'LIST' }],
    }),
    deleteAbsence: builder.mutation<void, string>({
      query: (id) => ({ url: `/absences/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Absence', id: 'LIST' }],
    }),
  }),
});

export const { useGetAbsencesQuery, useSaveAbsenceMutation, useDeleteAbsenceMutation } = absencesApi;
