// Keep in sync with the frontend matrix in src/utils/permissions.ts.
export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'GUEST';

const staff = [
  'shifts.view', 'shifts.viewAll', 'notifications.view', 'notifications.manage', 'announcements.view', 'profile.view', 'profile.edit',
  'dashboard.view', 'tasks.view', 'tasks.create', 'tasks.complete', 'handover.view', 'handover.create', 'handover.acknowledge',
] as const;

const management = [
  ...staff, 'employees.view', 'employees.create', 'employees.edit', 'shifts.viewAll', 'shifts.create', 'shifts.edit',
  'announcements.create', 'announcements.manage', 'tasks.manageTemplates', 'tasks.manage', 'handover.manage',
] as const;

const rolePermissions: Record<Role, readonly string[]> = {
  ADMIN: [...management, 'employees.delete', 'shifts.delete', 'accounts.manage'],
  MANAGER: management,
  EMPLOYEE: staff,
  GUEST: ['dashboard.view', 'shifts.view', 'shifts.viewAll', 'notifications.view', 'announcements.view', 'tasks.view', 'handover.view'],
};

export function hasPermission(role: Role, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}
