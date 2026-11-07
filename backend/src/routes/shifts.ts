import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, idParam } from '../lib/http.js';
import { notifyEmployee, notifyRoles } from '../lib/notify.js';
import { addDays, shiftTypeFromTime } from '../lib/shiftSlots.js';
import { can, requirePermission } from '../middleware/auth.js';
import { config } from '../config.js';

export const shiftsRouter = Router();

const shiftSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['DAY', 'NIGHT']).optional(),
  startTime: z.string().default(''),
  endTime: z.string().default(''),
  department: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).default('scheduled'),
});

type ShiftRow = { id: string; employeeId: string; date: string; type: string; startTime: string; endTime: string; employee?: { firstName: string; lastName: string } };

const withName = ({ employee, ...shift }: ShiftRow) => ({ ...shift, employeeName: employee ? `${employee.firstName} ${employee.lastName}` : '' });

function minutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function interval(shift: { type: string; startTime: string; endTime: string }) {
  const defaults = config.shiftHours[shift.type as 'DAY' | 'NIGHT'];
  const start = minutes(shift.startTime || defaults.start);
  let end = minutes(shift.endTime || defaults.end);
  if (end <= start) end += 24 * 60; // night shifts run past midnight
  return [start, end] as const;
}

async function warnAboutConflict(shift: ShiftRow & { employeeName: string }, actorId: string) {
  const others = await prisma.shift.findMany({ where: { employeeId: shift.employeeId, date: shift.date, NOT: { id: shift.id } } });
  const [start, end] = interval(shift);
  if (!others.some((other) => { const [s, e] = interval(other); return start < e && s < end; })) return;
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'Shift conflict detected', message: `${shift.employeeName} has overlapping shifts on ${shift.date}.`,
    type: 'warning', relatedType: 'shift', relatedId: shift.id,
  }, actorId);
}

shiftsRouter.get('/', requirePermission('shifts.view'), async (req, res) => {
  const { weekStart, endDate } = z.object({ weekStart: z.string().optional(), endDate: z.string().optional() }).parse(req.query);
  const where: Record<string, unknown> = weekStart ? { date: { gte: weekStart, lt: endDate ?? addDays(weekStart, 7) } } : {};
  if (!can(req, 'shifts.viewAll')) where.employee = { userId: req.user!.id };
  const shifts = await prisma.shift.findMany({ where, include: { employee: true }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
  res.json(shifts.map(withName));
});

shiftsRouter.post('/', requirePermission('shifts.create'), async (req, res) => {
  const data = shiftSchema.parse(req.body);
  const type = data.type ?? shiftTypeFromTime(data.startTime);
  const absence = await prisma.absence.findUnique({ where: { employeeId_date: { employeeId: data.employeeId, date: data.date } } });
  if (absence) await prisma.absence.delete({ where: { id: absence.id } });
  const shift = withName(await prisma.shift.create({ data: { ...data, type }, include: { employee: true } }));
  await notifyEmployee(shift.employeeId, {
    title: 'New shift assigned', message: `You have a ${type === 'NIGHT' ? 'night' : 'day'} shift on ${shift.date}.`,
    type: 'info', relatedType: 'shift', relatedId: shift.id,
  }, req.user!.id);
  await warnAboutConflict(shift, req.user!.id);
  res.status(201).json(shift);
});

shiftsRouter.put('/:id', requirePermission('shifts.edit'), async (req, res) => {
  const data = shiftSchema.parse(req.body);
  const previous = await prisma.shift.findUniqueOrThrow({ where: { id: idParam(req) } });
  const shift = withName(await prisma.shift.update({
    where: { id: previous.id }, data: { ...data, type: data.type ?? shiftTypeFromTime(data.startTime) }, include: { employee: true },
  }));
  if (previous.employeeId !== shift.employeeId) {
    await notifyEmployee(previous.employeeId, {
      title: 'Shift reassigned', message: `Your shift on ${previous.date} was reassigned.`, type: 'warning', relatedType: 'shift', relatedId: shift.id,
    }, req.user!.id);
  }
  await notifyEmployee(shift.employeeId, {
    title: 'Shift updated', message: `Your shift is now scheduled for ${shift.date}.`, type: 'info', relatedType: 'shift', relatedId: shift.id,
  }, req.user!.id);
  await warnAboutConflict(shift, req.user!.id);
  res.json(shift);
});

shiftsRouter.delete('/:id', requirePermission('shifts.delete'), async (req, res) => {
  const shift = await prisma.shift.delete({ where: { id: idParam(req) } });
  await notifyEmployee(shift.employeeId, {
    title: 'Shift cancelled', message: `Your shift on ${shift.date} was cancelled.`, type: 'warning', relatedType: 'shift', relatedId: shift.id,
  }, req.user!.id);
  res.status(204).end();
});

export const absencesRouter = Router();

absencesRouter.get('/', requirePermission('shifts.view'), async (req, res) => {
  const { from, to } = z.object({ from: z.string(), to: z.string() }).parse(req.query);
  res.json(await prisma.absence.findMany({ where: { date: { gte: from, lt: to } } }));
});

absencesRouter.put('/', requirePermission('shifts.create'), async (req, res) => {
  const data = z.object({
    employeeId: z.string(), date: z.string(), type: z.enum(['PAID_LEAVE', 'SICK', 'UNAVAILABLE']), note: z.string().optional(),
  }).parse(req.body);
  if (await prisma.shift.count({ where: { employeeId: data.employeeId, date: data.date } })) {
    throw badRequest('The employee already has a shift on this day. Remove the shift first.');
  }
  res.json(await prisma.absence.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date: data.date } }, create: data, update: data,
  }));
});

absencesRouter.delete('/:id', requirePermission('shifts.create'), async (req, res) => {
  await prisma.absence.delete({ where: { id: idParam(req) } });
  res.status(204).end();
});
