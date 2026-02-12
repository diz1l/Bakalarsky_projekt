import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { Loader } from '@/components/ui/Loader/Loader';

export function AuthGuard() {
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const shouldFetchMe = !!token && !user;
  const { isLoading } = useGetMeQuery(undefined, { skip: !shouldFetchMe });

  if (!token) return <Navigate to="/login" replace />;
  if (isLoading) return <Loader fullScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
