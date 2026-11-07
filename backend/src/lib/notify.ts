import { prisma } from './prisma.js';

interface Content {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  relatedType?: string;
  relatedId?: string;
}

const SYSTEM = { name: 'Staff Manager', email: 'noreply@hotel.com' };

// Users never receive notifications about their own actions.
export async function notifyUsers(userIds: string[], content: Content, actorId?: string | null) {
  const recipients = [...new Set(userIds)].filter((id) => id !== actorId);
  if (!recipients.length) return;
  const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId } }) : null;
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      ...content,
      userId,
      senderName: actor?.name ?? SYSTEM.name,
      senderEmail: actor?.email ?? SYSTEM.email,
    })),
  });
}

export async function notifyRoles(roles: string[], content: Content, actorId?: string | null) {
  const users = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
  await notifyUsers(users.map((user) => user.id), content, actorId);
}

export async function notifyEmployee(employeeId: string, content: Content, actorId?: string | null) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (employee?.userId) await notifyUsers([employee.userId], content, actorId);
}
