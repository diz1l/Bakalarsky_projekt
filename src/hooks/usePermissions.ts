import { useAuth } from './useAuth';
import { hasPermission, hasAnyPermission } from '@/utils/permissions';
import type { Permission } from '@/utils/permissions';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    can: (permission: Permission) => (role ? hasPermission(role, permission) : false),
    canAny: (permissions: Permission[]) => (role ? hasAnyPermission(role, permissions) : false),
    role,
  };
}
