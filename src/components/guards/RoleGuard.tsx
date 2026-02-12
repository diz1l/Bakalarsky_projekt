import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/utils/permissions';
import type { ReactNode } from 'react';

interface RoleGuardProps {
  permissions: Permission[];
  children: ReactNode;
  fallback?: string;
}

export function RoleGuard({ permissions, children, fallback = '/dashboard' }: RoleGuardProps) {
  const { canAny } = usePermissions();
  if (!canAny(permissions)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
