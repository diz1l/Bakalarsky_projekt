import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { notFound, idParam } from '../lib/http.js';
import { requirePermission } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requirePermission('notifications.view'), async (req, res) => {
  res.json(await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } }));
});

notificationsRouter.patch('/read-all', requirePermission('notifications.manage'), async (req, res) => {
  const unread = await prisma.notification.findMany({ where: { userId: req.user!.id, read: false } });
  await prisma.notification.updateMany({ where: { id: { in: unread.map((item) => item.id) } }, data: { read: true } });
  res.json(unread.map((item) => ({ ...item, read: true })));
});

notificationsRouter.patch('/:id/read', requirePermission('notifications.manage'), async (req, res) => {
  const item = await prisma.notification.findFirst({ where: { id: idParam(req), userId: req.user!.id } });
  if (!item) throw notFound();
  res.json(await prisma.notification.update({ where: { id: item.id }, data: { read: true } }));
});

notificationsRouter.delete('/', requirePermission('notifications.manage'), async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
  res.status(204).end();
});
