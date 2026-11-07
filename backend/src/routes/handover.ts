import { Router } from 'express';
import { z } from 'zod';
import type { HandoverAck, HandoverNote } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound, idParam } from '../lib/http.js';
import { notifyUsers } from '../lib/notify.js';
import { compareSlots, getCurrentSlot, getNextSlot, shiftTypeFromTime, type ShiftType } from '../lib/shiftSlots.js';
import { can, requirePermission } from '../middleware/auth.js';

export const handoverRouter = Router();

type NoteWithAcks = HandoverNote & { acknowledgements: HandoverAck[] };
const PRIORITY_ORDER: Record<string, number> = { critical: 0, important: 1, normal: 2 };

function status(note: NoteWithAcks) {
  if (note.resolvedAt) return 'resolved';
  return note.acknowledgements.some((ack) => (note.requiresAction ? ack.actionTakenAt : ack.readAt)) ? 'acknowledged' : 'open';
}

// Recipients are the people scheduled on the target shift; with nobody scheduled, the whole department.
export async function expectedRecipients(note: HandoverNote) {
  const departmentFilter = note.department === 'ALL' ? {} : { department: note.department };
  const shifts = await prisma.shift.findMany({
    where: { date: note.targetDate, status: { not: 'cancelled' }, ...departmentFilter },
    include: { employee: true },
  });
  let employees = shifts
    .filter((shift) => (shift.type || shiftTypeFromTime(shift.startTime)) === note.targetShiftType)
    .map((shift) => shift.employee);
  if (!employees.length) {
    employees = await prisma.employee.findMany({ where: { status: 'active', ...departmentFilter } });
  }
  const unique = new Map(
    employees
      .filter((employee) => employee.status === 'active' && employee.userId && employee.userId !== note.authorId)
      .map((employee) => [employee.userId!, `${employee.firstName} ${employee.lastName}`]),
  );
  return [...unique].map(([userId, name]) => ({ userId, name }));
}

async function present(note: NoteWithAcks) {
  return { ...note, status: status(note), expectedRecipients: await expectedRecipients(note) };
}

// Unhandled action items follow the shifts instead of silently expiring. Run from a scheduler in production.
export async function forwardOverdue() {
  const current = getCurrentSlot();
  const notes = await prisma.handoverNote.findMany({ where: { requiresAction: true, resolvedAt: null }, include: { acknowledgements: true } });
  for (const note of notes) {
    if (status(note) !== 'open') continue;
    let target = { date: note.targetDate, type: note.targetShiftType as ShiftType };
    while (compareSlots(target, current) < 0) target = getNextSlot(target);
    if (target.date !== note.targetDate || target.type !== note.targetShiftType) {
      await prisma.handoverNote.update({ where: { id: note.id }, data: { targetDate: target.date, targetShiftType: target.type } });
    }
  }
}

handoverRouter.get('/', requirePermission('handover.view'), async (req, res) => {
  const { scope } = z.object({ scope: z.enum(['active', 'archive']).default('active') }).parse(req.query);
  await forwardOverdue();
  const notes = await prisma.handoverNote.findMany({
    where: { resolvedAt: scope === 'archive' ? { not: null } : null },
    include: { acknowledgements: true },
    orderBy: scope === 'archive' ? { resolvedAt: 'desc' } : { createdAt: 'desc' },
  });
  if (scope === 'active') notes.sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]);
  res.json(await Promise.all(notes.map(present)));
});

handoverRouter.post('/', requirePermission('handover.create'), async (req, res) => {
  const data = z.object({
    title: z.string().trim().min(1), content: z.string().trim().min(1),
    category: z.enum(['guests', 'rooms', 'maintenance', 'cash', 'security', 'other']),
    priority: z.enum(['normal', 'important', 'critical']), department: z.string(), requiresAction: z.boolean(),
    targetDate: z.string().optional(), targetShiftType: z.enum(['DAY', 'NIGHT']).optional(),
  }).parse(req.body);

  const current = getCurrentSlot();
  const target = data.targetDate && data.targetShiftType ? { date: data.targetDate, type: data.targetShiftType } : getNextSlot(current);
  const note = await prisma.handoverNote.create({
    data: {
      ...data, date: current.date, shiftType: current.type, targetDate: target.date, targetShiftType: target.type,
      authorId: req.user!.id, authorName: req.user!.name,
    },
    include: { acknowledgements: true },
  });

  const result = await present(note);
  const content = {
    title: note.priority === 'critical' ? 'Critical shift handover' : 'New shift handover',
    message: note.title,
    type: (note.priority === 'critical' ? 'error' : note.priority === 'important' ? 'warning' : 'info') as 'error' | 'warning' | 'info',
    relatedType: 'handover',
    relatedId: note.id,
  };
  const recipientIds = result.expectedRecipients.map((recipient) => recipient.userId);
  if (note.priority === 'critical') {
    const managers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'MANAGER'] } }, select: { id: true } });
    recipientIds.push(...managers.map((manager) => manager.id));
  }
  await notifyUsers(recipientIds, content, req.user!.id);
  res.status(201).json(result);
});

handoverRouter.patch('/:id', requirePermission('handover.create'), async (req, res) => {
  const body = z.object({
    status: z.enum(['open', 'resolved']).optional(), title: z.string().min(1).optional(), content: z.string().min(1).optional(),
    category: z.string().optional(), priority: z.string().optional(), department: z.string().optional(), requiresAction: z.boolean().optional(),
  }).parse(req.body);
  const note = await prisma.handoverNote.findUnique({ where: { id: idParam(req) }, include: { acknowledgements: true } });
  if (!note) throw notFound();
  const canManage = can(req, 'handover.manage');
  const isAuthor = note.authorId === req.user!.id;
  const { status: nextStatus, ...edits } = body;

  const data: Record<string, unknown> = {};
  if (nextStatus) {
    if (!canManage && !isAuthor) throw forbidden();
    Object.assign(data, nextStatus === 'resolved' ? { resolvedAt: new Date(), resolvedBy: req.user!.name } : { resolvedAt: null, resolvedBy: null });
  }
  if (Object.keys(edits).length) {
    if (!canManage && !(isAuthor && !note.acknowledgements.length)) throw forbidden('The note can no longer be edited after it was acknowledged.');
    Object.assign(data, edits);
  }
  const updated = await prisma.handoverNote.update({ where: { id: note.id }, data, include: { acknowledgements: true } });
  res.json(await present(updated));
});

handoverRouter.delete('/:id', requirePermission('handover.create'), async (req, res) => {
  const note = await prisma.handoverNote.findUnique({ where: { id: idParam(req) }, include: { acknowledgements: true } });
  if (!note) throw notFound();
  if (!can(req, 'handover.manage') && !(note.authorId === req.user!.id && !note.acknowledgements.length)) throw forbidden();
  await prisma.handoverNote.delete({ where: { id: note.id } });
  res.status(204).end();
});

handoverRouter.post('/:id/ack', requirePermission('handover.acknowledge'), async (req, res) => {
  const body = z.object({ read: z.boolean().optional(), actionTaken: z.boolean().optional(), comment: z.string().optional() }).parse(req.body);
  if (body.actionTaken && !body.comment?.trim()) throw badRequest('Describe what was done');
  const note = await prisma.handoverNote.findUnique({ where: { id: idParam(req) } });
  if (!note) throw notFound();
  const key = { noteId_userId: { noteId: note.id, userId: req.user!.id } };

  if (body.read === false && !body.actionTaken) {
    await prisma.handoverAck.deleteMany({ where: { noteId: note.id, userId: req.user!.id } });
  } else {
    const action = body.actionTaken === true
      ? { actionTakenAt: new Date(), comment: body.comment!.trim() }
      : body.actionTaken === false ? { actionTakenAt: null, comment: null } : {};
    await prisma.handoverAck.upsert({
      where: key,
      create: { noteId: note.id, userId: req.user!.id, userName: req.user!.name, ...action },
      update: action,
    });
  }

  const updated = await prisma.handoverNote.findUniqueOrThrow({ where: { id: note.id }, include: { acknowledgements: true } });
  if (body.actionTaken) {
    await notifyUsers([note.authorId], {
      title: 'Handover: action taken', message: `${req.user!.name}: ${body.comment} — "${note.title}"`,
      type: 'success', relatedType: 'handover', relatedId: note.id,
    }, req.user!.id);
  }
  res.json(await present(updated));
});
