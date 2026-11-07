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
  | 'dashboard.view'
  | 'accounts.manage'
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.complete'
  | 'tasks.manageTemplates'
  | 'tasks.manage'
  | 'handover.view'
  | 'handover.create'
  | 'handover.acknowledge'
  | 'handover.manage';

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
    'accounts.manage',
    'tasks.view',
    'tasks.create',
    'tasks.complete',
    'tasks.manageTemplates',
    'tasks.manage',
    'handover.view',
    'handover.create',
    'handover.acknowledge',
    'handover.manage',
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
    'tasks.view',
    'tasks.create',
    'tasks.complete',
    'tasks.manageTemplates',
    'tasks.manage',
    'handover.view',
    'handover.create',
    'handover.acknowledge',
    'handover.manage',
  ],
  EMPLOYEE: [
    'shifts.view',
    'shifts.viewAll',
    'notifications.view',
    'notifications.manage',
    'announcements.view',
    'profile.view',
    'profile.edit',
    'dashboard.view',
    'tasks.view',
    'tasks.create',
    'tasks.complete',
    'handover.view',
    'handover.create',
    'handover.acknowledge',
  ],
  GUEST: [
    'dashboard.view',
    'tasks.view',
    'handover.view',
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
