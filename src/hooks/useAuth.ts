import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import { useCallback } from 'react';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);

  const handleLogout = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  return {
    isAuthenticated: !!token && !!user,
    user,
    token,
    logout: handleLogout,
  };
}
