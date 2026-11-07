import { Router } from 'express';
import { z } from 'zod';
import { idParam } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { notifyRoles, notifyUsers } from '../lib/notify.js';
import { requirePermission } from '../middleware/auth.js';

export const announcementsRouter = Router();

announcementsRouter.get('/', requirePermission('announcements.view'), async (_req, res) => {
  res.json(await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }));
});

announcementsRouter.post('/', requirePermission('announcements.create'), async (req, res) => {
  const data = z.object({ title: z.string().min(1), content: z.string().min(1), priority: z.enum(['low', 'medium', 'high']) }).parse(req.body);
  const announcement = await prisma.announcement.create({ data: { ...data, authorId: req.user!.id, authorName: req.user!.name } });
  await notifyRoles(['ADMIN', 'MANAGER', 'EMPLOYEE'], {
    title: data.priority === 'high' ? 'Important announcement' : 'New announcement', message: data.title,
    type: data.priority === 'high' ? 'warning' : 'info', relatedType: 'announcement', relatedId: announcement.id,
  }, req.user!.id);
  res.status(201).json(announcement);
});

announcementsRouter.patch('/:id', requirePermission('announcements.manage'), async (req, res) => {
  const { completed } = z.object({ completed: z.boolean() }).parse(req.body);
  const announcement = await prisma.announcement.update({
    where: { id: idParam(req) },
    data: { completed, completedAt: completed ? new Date() : null, completedBy: completed ? req.user!.id : null },
  });
  if (completed) {
    await notifyUsers([announcement.authorId], {
      title: 'Announcement completed', message: `"${announcement.title}" was marked as completed.`,
      type: 'success', relatedType: 'announcement', relatedId: announcement.id,
    }, req.user!.id);
  }
  res.json(announcement);
});

announcementsRouter.delete('/:id', requirePermission('announcements.manage'), async (req, res) => {
  await prisma.announcement.delete({ where: { id: idParam(req) } });
  res.status(204).end();
});
