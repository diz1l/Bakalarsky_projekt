import { baseApi } from '@/app/baseApi';
import type { Employee } from '@/types';

export const employeesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmployees: builder.query<Employee[], void>({
      query: () => '/employees',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Employee' as const, id })), { type: 'Employee', id: 'LIST' }]
          : [{ type: 'Employee', id: 'LIST' }],
    }),
    getEmployee: builder.query<Employee, string>({
      query: (id) => `/employees/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Employee', id }],
    }),
    createEmployee: builder.mutation<Employee, Omit<Employee, 'id'>>({
      query: (body) => ({ url: '/employees', method: 'POST', body }),
      invalidatesTags: [{ type: 'Employee', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
    updateEmployee: builder.mutation<Employee, Employee>({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
        { type: 'Notification', id: 'LIST' },
      ],
    }),
    deleteEmployee: builder.mutation<void, string>({
      query: (id) => ({ url: `/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Employee', id: 'LIST' }, { type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetEmployeesQuery,
  useGetEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} = employeesApi;
