import { baseApi } from '@/app/baseApi';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ManagedAccount,
  ResetPasswordRequest,
  UpdateProfileRequest,
  User,
} from '@/types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    guestLogin: builder.mutation<LoginResponse, void>({
      query: () => ({ url: '/auth/guest', method: 'POST' }),
    }),
    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<{ message: string }, ResetPasswordRequest>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    updateProfile: builder.mutation<User, UpdateProfileRequest>({
      query: (body) => ({ url: '/auth/profile', method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
    changePassword: builder.mutation<{ message: string }, ChangePasswordRequest>({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),
    getMe: builder.query<User, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
    getManagedAccounts: builder.query<ManagedAccount[], void>({
      query: () => '/auth/accounts',
      providesTags: ['User'],
    }),
    createManagedAccount: builder.mutation<
      { account: ManagedAccount; temporaryPassword: string },
      { employeeId: string; login: string }
    >({
      query: (body) => ({ url: '/auth/accounts', method: 'POST', body }),
      invalidatesTags: ['User', 'Employee'],
    }),
    resetManagedAccountPassword: builder.mutation<{ temporaryPassword: string }, string>({
      query: (userId) => ({ url: `/auth/accounts/${userId}/reset-password`, method: 'POST' }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useGuestLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useGetMeQuery,
  useGetManagedAccountsQuery,
  useCreateManagedAccountMutation,
  useResetManagedAccountPasswordMutation,
} = authApi;
