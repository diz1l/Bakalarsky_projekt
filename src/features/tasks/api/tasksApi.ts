import { baseApi } from '@/app/baseApi';
import type { ShiftTask, ShiftType, TaskTemplate } from '@/types';

export type CreateTaskPayload = Pick<ShiftTask, 'title' | 'date' | 'shiftType' | 'department' | 'priority'> &
  Partial<Pick<ShiftTask, 'description' | 'section' | 'sortOrder' | 'assigneeId' | 'dueTime'>>;

export type TemplatePayload = Omit<TaskTemplate, 'id' | 'createdBy'>;

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<ShiftTask[], { date: string; shiftType: ShiftType; department?: string }>({
      query: ({ date, shiftType, department }) =>
        `/tasks?date=${date}&shiftType=${shiftType}${department ? `&department=${encodeURIComponent(department)}` : ''}`,
      providesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    createTask: builder.mutation<ShiftTask, CreateTaskPayload>({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    updateTask: builder.mutation<ShiftTask, Partial<ShiftTask> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    updateTasksBulk: builder.mutation<{ updated: number }, { ids: string[]; status: 'open' | 'done' }>({
      query: (body) => ({ url: '/tasks/bulk', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    deleteTask: builder.mutation<void, string>({
      query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    getTaskTemplates: builder.query<TaskTemplate[], void>({
      query: () => '/task-templates',
      providesTags: [{ type: 'TaskTemplate', id: 'LIST' }],
    }),
    createTaskTemplate: builder.mutation<TaskTemplate, TemplatePayload>({
      query: (body) => ({ url: '/task-templates', method: 'POST', body }),
      invalidatesTags: [{ type: 'TaskTemplate', id: 'LIST' }, { type: 'Task', id: 'LIST' }],
    }),
    updateTaskTemplate: builder.mutation<TaskTemplate, TemplatePayload & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/task-templates/${id}`, method: 'PUT', body }),
      invalidatesTags: [{ type: 'TaskTemplate', id: 'LIST' }, { type: 'Task', id: 'LIST' }],
    }),
    deleteTaskTemplate: builder.mutation<void, string>({
      query: (id) => ({ url: `/task-templates/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TaskTemplate', id: 'LIST' }, { type: 'Task', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpdateTasksBulkMutation,
  useDeleteTaskMutation,
  useGetTaskTemplatesQuery,
  useCreateTaskTemplateMutation,
  useUpdateTaskTemplateMutation,
  useDeleteTaskTemplateMutation,
} = tasksApi;
