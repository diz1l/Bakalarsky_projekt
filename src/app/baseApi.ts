import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    fetchFn: (input, init) => {
      if (!init) return fetch(input);
      const requestInit: RequestInit = { ...init };
      delete requestInit.signal;
      return fetch(input, requestInit);
    },
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Employee', 'Shift', 'Absence', 'ScheduleRequest', 'Notification', 'Announcement', 'User', 'Task', 'TaskTemplate', 'Handover'],
  endpoints: () => ({}),
});
