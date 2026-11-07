import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound, idParam } from '../lib/http.js';
import { notifyEmployee } from '../lib/notify.js';
import { compareSlots, getCurrentSlot, getNextSlot, getPreviousSlot, type ShiftSlot } from '../lib/shiftSlots.js';
import { can, requirePermission } from '../middleware/auth.js';

export const tasksRouter = Router();
export const taskTemplatesRouter = Router();

const priority = z.enum(['low', 'medium', 'high']);
const shiftType = z.enum(['DAY', 'NIGHT']);

function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Checklists are generated lazily from the previous shift onwards; the unique key keeps it idempotent.
export async function ensureTemplateTasks(slot: ShiftSlot) {
  if (compareSlots(slot, getPreviousSlot(getCurrentSlot())) < 0) return;
  const templates = await prisma.taskTemplate.findMany({ where: { active: true, shiftType: { in: ['ANY', slot.type] } } });
  for (const template of templates) {
    const weekdays = template.weekdays ? template.weekdays.split(',').map(Number) : [];
    if (weekdays.length && !weekdays.includes(isoWeekday(slot.date))) continue;
    await prisma.shiftTask.upsert({
      where: { templateId_date_shiftType: { templateId: template.id, date: slot.date, shiftType: slot.type } },
      update: {},
      create: {
        templateId: template.id, title: template.title, description: template.description, date: slot.date, shiftType: slot.type,
        department: template.department, priority: template.priority, dueTime: template.dueTime,
        createdBy: template.createdBy, createdByName: 'Staff Manager',
      },
    });
  }
}

// Open one-off tasks of finished shifts move to the next shift; `carriedOverFrom` is unique, so it happens once.
// In production run this from a scheduler every few minutes instead of on each request.
export async function carryOverUnfinishedTasks() {
  const current = getCurrentSlot();
  const open = await prisma.shiftTask.findMany({ where: { status: 'open', templateId: null, date: { lte: current.date } } });
  for (const task of open) {
    if (compareSlots({ date: task.date, type: task.shiftType as 'DAY' | 'NIGHT' }, current) >= 0) continue;
    const next = getNextSlot({ date: task.date, type: task.shiftType as 'DAY' | 'NIGHT' });
    await prisma.shiftTask.upsert({
      where: { carriedOverFrom: task.id },
      update: {},
      create: {
        title: task.title, description: task.description, department: task.department, assigneeId: task.assigneeId,
        priority: task.priority, dueTime: task.dueTime, createdBy: task.createdBy, createdByName: task.createdByName,
        date: next.date, shiftType: next.type, carriedOverFrom: task.id,
      },
    });
  }
}

tasksRouter.get('/', requirePermission('tasks.view'), async (req, res) => {
  const query = z.object({ date: z.string(), shiftType, department: z.string().optional() }).parse(req.query);
  await carryOverUnfinishedTasks();
  await ensureTemplateTasks({ date: query.date, type: query.shiftType });
  const tasks = await prisma.shiftTask.findMany({
    where: {
      date: query.date,
      shiftType: query.shiftType,
      ...(query.department ? { department: { in: [query.department, 'ALL'] } } : {}),
    },
    orderBy: [{ status: 'asc' }, { dueTime: 'asc' }],
  });
  res.json(tasks);
});

tasksRouter.post('/', requirePermission('tasks.create'), async (req, res) => {
  const data = z.object({
    title: z.string().trim().min(1), description: z.string().optional(), date: z.string(), shiftType,
    department: z.string(), assigneeId: z.string().optional(), priority, dueTime: z.string().optional(),
  }).parse(req.body);

  if (!can(req, 'tasks.manage')) {
    const current = getCurrentSlot();
    const slot = { date: data.date, type: data.shiftType };
    if (compareSlots(slot, current) < 0 || compareSlots(slot, getNextSlot(current)) > 0) {
      throw forbidden('Employees can add tasks only for the current or the next shift.');
    }
  }

  const task = await prisma.shiftTask.create({ data: { ...data, createdBy: req.user!.id, createdByName: req.user!.name } });
  if (task.assigneeId) {
    await notifyEmployee(task.assigneeId, {
      title: 'New shift task', message: task.title, type: task.priority === 'high' ? 'warning' : 'info', relatedType: 'task', relatedId: task.id,
    }, req.user!.id);
  }
  res.status(201).json(task);
});

tasksRouter.patch('/:id', requirePermission('tasks.complete'), async (req, res) => {
  const body = z.object({
    status: z.enum(['open', 'done', 'skipped']).optional(), comment: z.string().optional(),
    title: z.string().min(1).optional(), description: z.string().optional(), priority: priority.optional(),
    dueTime: z.string().optional(), assigneeId: z.string().optional(), department: z.string().optional(),
  }).parse(req.body);
  const task = await prisma.shiftTask.findUnique({ where: { id: idParam(req) } });
  if (!task) throw notFound();
  const canManage = can(req, 'tasks.manage');
  const { status, comment, ...edits } = body;

  const data: Record<string, unknown> = {};
  if (status && status !== task.status) {
    if (status === 'skipped' && !comment?.trim()) throw badRequest('A comment is required to skip a task');
    if (status === 'open' && task.completedBy && task.completedBy !== req.user!.id && !canManage) {
      throw forbidden('Only the person who completed the task or a manager can reopen it.');
    }
    Object.assign(data, status === 'open'
      ? { status, completedBy: null, completedByName: null, completedAt: null, comment: null }
      : { status, completedBy: req.user!.id, completedByName: req.user!.name, completedAt: new Date(), comment: comment?.trim() || null });
  }
  if (Object.keys(edits).length) {
    if (!canManage && task.createdBy !== req.user!.id) throw forbidden();
    Object.assign(data, edits);
  }
  res.json(await prisma.shiftTask.update({ where: { id: task.id }, data }));
});

tasksRouter.delete('/:id', requirePermission('tasks.create'), async (req, res) => {
  const task = await prisma.shiftTask.findUnique({ where: { id: idParam(req) } });
  if (!task) throw notFound();
  if (!can(req, 'tasks.manage') && task.createdBy !== req.user!.id) throw forbidden();
  await prisma.shiftTask.delete({ where: { id: task.id } });
  res.status(204).end();
});

const templateSchema = z.object({
  title: z.string().trim().min(1), description: z.string().optional(), shiftType: z.enum(['DAY', 'NIGHT', 'ANY']),
  department: z.string(), weekdays: z.array(z.number().int().min(1).max(7)).default([]), dueTime: z.string().optional(),
  priority, active: z.boolean().default(true),
});

const toTemplate = <T extends { weekdays: string }>(template: T) => ({
  ...template, weekdays: template.weekdays ? template.weekdays.split(',').map(Number) : [],
});

taskTemplatesRouter.get('/', requirePermission('tasks.view'), async (_req, res) => {
  res.json((await prisma.taskTemplate.findMany()).map(toTemplate));
});

taskTemplatesRouter.post('/', requirePermission('tasks.manageTemplates'), async (req, res) => {
  const { weekdays, ...data } = templateSchema.parse(req.body);
  const template = await prisma.taskTemplate.create({ data: { ...data, weekdays: weekdays.join(','), createdBy: req.user!.id } });
  res.status(201).json(toTemplate(template));
});

taskTemplatesRouter.put('/:id', requirePermission('tasks.manageTemplates'), async (req, res) => {
  const { weekdays, ...data } = templateSchema.parse(req.body);
  const template = await prisma.taskTemplate.update({ where: { id: idParam(req) }, data: { ...data, weekdays: weekdays.join(',') } });
  res.json(toTemplate(template));
});

taskTemplatesRouter.delete('/:id', requirePermission('tasks.manageTemplates'), async (req, res) => {
  await prisma.taskTemplate.delete({ where: { id: idParam(req) } });
  res.status(204).end();
});
