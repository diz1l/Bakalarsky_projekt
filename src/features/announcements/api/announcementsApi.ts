import { baseApi } from '@/app/baseApi';
import type { Announcement } from '@/types';

export type CreateAnnouncementPayload = Pick<Announcement, 'title' | 'content' | 'priority'>;

export const announcementsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAnnouncements: builder.query<Announcement[], void>({
      query: () => '/announcements',
      providesTags: [{ type: 'Announcement', id: 'LIST' }],
    }),
    createAnnouncement: builder.mutation<Announcement, CreateAnnouncementPayload>({
      query: (body) => ({ url: '/announcements', method: 'POST', body }),
      invalidatesTags: [{ type: 'Announcement', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    toggleAnnouncementDone: builder.mutation<Announcement, { id: string; completed: boolean }>({
      query: ({ id, ...body }) => ({ url: `/announcements/${id}`, method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Announcement', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    deleteAnnouncement: builder.mutation<void, string>({
      query: (id) => ({ url: `/announcements/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Announcement', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useToggleAnnouncementDoneMutation,
  useDeleteAnnouncementMutation,
} = announcementsApi;
