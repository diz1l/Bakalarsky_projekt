import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
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
  tagTypes: ['Employee', 'Shift', 'Absence', 'Notification', 'Announcement', 'User', 'Task', 'TaskTemplate', 'Handover'],
  endpoints: () => ({}),
});
