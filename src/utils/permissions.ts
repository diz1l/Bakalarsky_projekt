import type { Role } from '@/types';

export type Permission =
  | 'employees.view'
  | 'employees.create'
  | 'employees.edit'
  | 'employees.delete'
  | 'shifts.view'
  | 'shifts.viewAll'
  | 'shifts.create'
  | 'shifts.edit'
  | 'shifts.delete'
  | 'notifications.view'
  | 'notifications.manage'
  | 'announcements.view'
  | 'announcements.create'
  | 'announcements.manage'
  | 'profile.view'
  | 'profile.edit'
  | 'dashboard.view';

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    'employees.view',
    'employees.create',
    'employees.edit',
    'employees.delete',
    'shifts.view',
    'shifts.viewAll',
    'shifts.create',
    'shifts.edit',
    'shifts.delete',
    'notifications.view',
    'notifications.manage',
    'announcements.view',
    'announcements.create',
    'announcements.manage',
    'profile.view',
    'profile.edit',
    'dashboard.view',
  ],
  MANAGER: [
    'employees.view',
    'employees.create',
    'employees.edit',
    'shifts.view',
    'shifts.viewAll',
    'shifts.create',
    'shifts.edit',
    'notifications.view',
    'notifications.manage',
    'announcements.view',
    'announcements.create',
    'announcements.manage',
    'profile.view',
    'profile.edit',
    'dashboard.view',
  ],
  EMPLOYEE: [
    'shifts.view',
    'notifications.view',
    'notifications.manage',
    'announcements.view',
    'profile.view',
    'profile.edit',
    'dashboard.view',
  ],
  GUEST: [
    'dashboard.view',
    'shifts.view',
    'shifts.viewAll',
    'notifications.view',
    'announcements.view',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}
