import { baseApi } from '@/app/baseApi';
import type { HandoverNote } from '@/types';

export type HandoverScope = 'active' | 'archive';

export type CreateHandoverPayload = Pick<
  HandoverNote,
  'title' | 'content' | 'category' | 'priority' | 'department' | 'requiresAction'
> &
  Partial<Pick<HandoverNote, 'targetDate' | 'targetShiftType'>>;

export const handoverApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHandoverNotes: builder.query<HandoverNote[], HandoverScope>({
      query: (scope) => `/handover?scope=${scope}`,
      providesTags: [{ type: 'Handover', id: 'LIST' }],
    }),
    createHandoverNote: builder.mutation<HandoverNote, CreateHandoverPayload>({
      query: (body) => ({ url: '/handover', method: 'POST', body }),
      invalidatesTags: [{ type: 'Handover', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    updateHandoverNote: builder.mutation<HandoverNote, Partial<HandoverNote> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/handover/${id}`, method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Handover', id: 'LIST' }],
    }),
    deleteHandoverNote: builder.mutation<void, string>({
      query: (id) => ({ url: `/handover/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Handover', id: 'LIST' }],
    }),
    acknowledgeHandover: builder.mutation<
      HandoverNote,
      { id: string; read?: boolean; actionTaken?: boolean; comment?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/handover/${id}/ack`, method: 'POST', body }),
      invalidatesTags: [{ type: 'Handover', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetHandoverNotesQuery,
  useCreateHandoverNoteMutation,
  useUpdateHandoverNoteMutation,
  useDeleteHandoverNoteMutation,
  useAcknowledgeHandoverMutation,
} = handoverApi;
