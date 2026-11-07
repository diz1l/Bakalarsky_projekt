import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import { baseApi } from '@/app/baseApi';
import { useCallback } from 'react';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    dispatch(baseApi.util.resetApiState());
  }, [dispatch]);

  return {
    isAuthenticated: !!token && !!user,
    user,
    token,
    logout: handleLogout,
  };
}
