import cron from 'node-cron';
import { prisma } from './lib/prisma.js';
import { notifyEmployee, notifyRoles } from './lib/notify.js';
import { compareSlots, getCurrentSlot, getNextSlot, type ShiftType } from './lib/shiftSlots.js';
import { carryOverUnfinishedTasks, ensureTemplateTasks } from './routes/tasks.js';
import { expectedRecipients, forwardOverdue } from './routes/handover.js';

let started = false;
let running = false;

export async function runScheduledJobs() {
  if (running) return;
  running = true;
  try {
    const current = getCurrentSlot();
    await ensureTemplateTasks(current);
    await ensureTemplateTasks(getNextSlot(current));
    await carryOverUnfinishedTasks();
    await forwardOverdue();
    await remindOverdueTasks(current);
    await escalateCriticalHandovers(current);
  } catch (error) {
    console.error('Scheduled maintenance job failed', error);
  } finally {
    running = false;
  }
}

export function startScheduledJobs() {
  if (started) return;
  started = true;
  cron.schedule('*/5 * * * *', () => void runScheduledJobs(), {
    timezone: process.env.SCHEDULER_TIMEZONE ?? 'Europe/Prague',
  });
  void runScheduledJobs();
}

async function remindOverdueTasks(current: ReturnType<typeof getCurrentSlot>) {
  const tasks = await prisma.shiftTask.findMany({ where: { status: 'open' } });
  for (const task of tasks) {
    const slot = { date: task.date, type: task.shiftType as ShiftType };
    if (compareSlots(slot, current) >= 0) continue;
    if (task.assigneeId) {
      const employee = await prisma.employee.findUnique({ where: { id: task.assigneeId }, select: { userId: true } });
      if (!employee?.userId) continue;
      const sent = await prisma.notification.findFirst({ where: { userId: employee.userId, relatedType: 'task', relatedId: task.id, title: 'Overdue shift task' } });
      if (!sent) await notifyEmployee(task.assigneeId, { title: 'Overdue shift task', message: `Task "${task.title}" from ${task.date} ${task.shiftType.toLowerCase()} is still open.`, type: task.priority === 'high' ? 'error' : 'warning', relatedType: 'task', relatedId: task.id });
    } else {
      const sent = await prisma.notification.findFirst({ where: { relatedType: 'task', relatedId: task.id, title: 'Overdue unassigned shift task' } });
      if (!sent) await notifyRoles(['ADMIN', 'MANAGER'], { title: 'Overdue unassigned shift task', message: `Task "${task.title}" from ${task.date} ${task.shiftType.toLowerCase()} is still open.`, type: 'warning', relatedType: 'task', relatedId: task.id });
    }
  }
}

async function escalateCriticalHandovers(current: ReturnType<typeof getCurrentSlot>) {
  const notes = await prisma.handoverNote.findMany({ where: { priority: 'critical', resolvedAt: null }, include: { acknowledgements: true } });
  const managers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'MANAGER'] } }, select: { id: true } });
  for (const note of notes) {
    if (compareSlots({ date: note.targetDate, type: note.targetShiftType as ShiftType }, current) >= 0) continue;
    const recipients = await expectedRecipients(note);
    const outstanding = recipients.filter((recipient) => !note.acknowledgements?.some((ack) => ack.userId === recipient.userId && (note.requiresAction ? ack.actionTakenAt : ack.readAt)));
    if (!outstanding.length) continue;
    if (managers.length) {
      const sent = await prisma.notification.findFirst({ where: { relatedType: 'handover', relatedId: note.id, title: 'Critical handover escalation' } });
      if (!sent)
      await notifyRoles(['ADMIN', 'MANAGER'], { title: 'Critical handover escalation', message: `Critical handover "${note.title}" for ${note.targetDate} is still awaiting acknowledgement.`, type: 'error', relatedType: 'handover', relatedId: note.id });
    }
  }
}
