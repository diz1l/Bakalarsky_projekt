import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from './apiConfig';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
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
