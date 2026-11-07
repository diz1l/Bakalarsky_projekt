import type { Notification, StaffRole } from '@/types';
import { db, genId, persistMockCollections } from './db';

type NotificationContent = Pick<
  Notification,
  'title' | 'message' | 'type' | 'relatedType' | 'relatedId'
>;

const SYSTEM_SENDER = {
  senderName: 'Staff Manager',
  senderEmail: 'noreply@hotel.com',
};

export function notifyUsers(
  userIds: string[],
  content: NotificationContent,
  senderUserId?: string | null,
): Notification[] {
  const sender = db.users.find((user) => user.id === senderUserId);
  const recipients = [...new Set(userIds)].filter((userId) => db.users.some((user) => user.id === userId));

  const created = recipients.map((userId): Notification => ({
    ...content,
    id: genId('not'),
    userId,
    read: false,
    createdAt: new Date().toISOString(),
    senderName: sender?.name ?? SYSTEM_SENDER.senderName,
    senderEmail: sender?.email ?? SYSTEM_SENDER.senderEmail,
  }));

  if (created.length) {
    db.notifications.unshift(...created);
    persistMockCollections();
  }

  return created;
}

export function notifyRoles(
  roles: StaffRole[],
  content: NotificationContent,
  excludeUserId?: string | null,
  senderUserId?: string | null,
): Notification[] {
  const userIds = db.users
    .filter((user) => user.role !== 'GUEST' && roles.includes(user.role) && user.id !== excludeUserId)
    .map((user) => user.id);
  return notifyUsers(userIds, content, senderUserId);
}

export function notifyEmployee(
  employeeId: string,
  content: NotificationContent,
  senderUserId?: string | null,
): Notification[] {
  const employee = db.employees.find((entry) => entry.id === employeeId);
  return employee?.userId ? notifyUsers([employee.userId], content, senderUserId) : [];
}
