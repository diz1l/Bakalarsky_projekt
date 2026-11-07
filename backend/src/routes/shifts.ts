import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, idParam } from '../lib/http.js';
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
  res.json(shifts.map((shift) => {
    const result = withName(shift);
    return can(req, 'shifts.create') ? result : { ...result, notes: undefined };
  }));
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

export const scheduleRequestsRouter = Router();
const requestSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), type: z.enum(['PAID_LEAVE', 'SICK', 'UNAVAILABLE']) });

scheduleRequestsRouter.get('/', requirePermission('shifts.view'), async (req, res) => {
  const { from, to } = z.object({ from: z.string(), to: z.string() }).parse(req.query);
  const where = { date: { gte: from, lt: to }, ...(!can(req, 'shifts.create') ? { employee: { userId: req.user!.id } } : {}) };
  const requests = await prisma.scheduleRequest.findMany({ where, include: { employee: { select: { firstName: true, lastName: true, department: true } } }, orderBy: [{ date: 'asc' }, { createdAt: 'desc' }] });
  res.json(requests.map(({ employee, ...request }) => ({ ...request, employeeName: `${employee.firstName} ${employee.lastName}`, department: employee.department })));
});

scheduleRequestsRouter.post('/', requirePermission('shifts.view'), async (req, res) => {
  if (can(req, 'shifts.create')) throw forbidden('Managers must update the schedule directly.');
  const data = requestSchema.parse(req.body);
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.id } });
  if (!employee) throw badRequest('No employee profile is linked to this account.');
  const request = await prisma.scheduleRequest.upsert({
    where: { employeeId_date: { employeeId: employee.id, date: data.date } },
    create: { ...data, employeeId: employee.id },
    update: { ...data, status: 'PENDING', reviewedAt: null, reviewedBy: null },
    include: { employee: { select: { firstName: true, lastName: true, department: true } } },
  });
  await notifyRoles(['ADMIN', 'MANAGER'], { title: 'Schedule request', message: `${employee.firstName} ${employee.lastName} requested a schedule change on ${data.date}.`, type: 'info', relatedType: 'shift', relatedId: request.id }, req.user!.id);
  res.status(201).json({ ...request, employeeName: `${employee.firstName} ${employee.lastName}`, department: employee.department });
});

scheduleRequestsRouter.put('/:id/review', requirePermission('shifts.create'), async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body);
  const request = await prisma.scheduleRequest.findUnique({ where: { id: idParam(req) }, include: { employee: true } });
  if (!request) throw badRequest('Schedule request not found.');
  if (request.status !== 'PENDING') throw badRequest('Schedule request has already been reviewed.');
  if (decision === 'APPROVED') {
    await prisma.shift.deleteMany({ where: { employeeId: request.employeeId, date: request.date } });
    await prisma.absence.upsert({ where: { employeeId_date: { employeeId: request.employeeId, date: request.date } }, create: { employeeId: request.employeeId, date: request.date, type: request.type }, update: { type: request.type } });
  }
  const updated = await prisma.scheduleRequest.update({ where: { id: request.id }, data: { status: decision, reviewedAt: new Date(), reviewedBy: req.user!.id } });
  await notifyEmployee(request.employeeId, { title: `Schedule request ${decision.toLowerCase()}`, message: `Your request for ${request.date} was ${decision.toLowerCase()}.`, type: decision === 'APPROVED' ? 'success' : 'warning', relatedType: 'shift', relatedId: request.id }, req.user!.id);
  res.json(updated);
});

absencesRouter.get('/', requirePermission('shifts.view'), async (req, res) => {
  const { from, to } = z.object({ from: z.string(), to: z.string() }).parse(req.query);
  res.json(await prisma.absence.findMany({ where: { date: { gte: from, lt: to } }, select: { id: true, employeeId: true, date: true, type: true } }));
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
