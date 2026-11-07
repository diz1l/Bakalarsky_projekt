import type { ShiftTask } from '@/types';
import { compareSlots, getCurrentSlot, getNextSlot, getPreviousSlot, type ShiftSlot } from '@/utils/shiftUtils';
import { db, genId, persistMockCollections } from './db';

const SYSTEM_NAME = 'Staff Manager';

// Checklists are generated for the previous shift onwards, so history is not filled with invented tasks.
export function ensureTemplateTasks(slot: ShiftSlot, now: Date = new Date()): boolean {
  if (compareSlots(slot, getPreviousSlot(getCurrentSlot(now))) < 0) return false;

  let created = false;
  for (const template of db.taskTemplates) {
    if (!template.active) continue;
    const exists = db.tasks.some(
      (task) => task.templateId === template.id && task.date === slot.date && task.shiftType === slot.type,
    );
    if (exists) continue;

    const author = db.users.find((user) => user.id === template.createdBy);
    db.tasks.push({
      id: genId('task'),
      templateId: template.id,
      title: template.title,
      description: template.description,
      date: slot.date,
      shiftType: slot.type,
      department: template.department,
      section: template.section ?? 'during',
      sortOrder: template.sortOrder ?? 0,
      priority: template.priority,
      dueTime: template.dueTime,
      status: 'open',
      createdBy: template.createdBy,
      createdByName: author?.name ?? SYSTEM_NAME,
      createdAt: now.toISOString(),
    });
    created = true;
  }
  return created;
}

// One-off tasks left open when their shift ends move to the next shift; the original stays as history.
export function carryOverUnfinishedTasks(now: Date = new Date()): ShiftTask[] {
  const current = getCurrentSlot(now);
  const carried: ShiftTask[] = [];

  for (const task of [...db.tasks]) {
    if (task.status !== 'open' || task.templateId) continue;
    const slot = { date: task.date, type: task.shiftType };
    if (compareSlots(slot, current) >= 0) continue;
    if (db.tasks.some((other) => other.carriedOverFrom === task.id)) continue;

    const next = getNextSlot(slot);
    const copy: ShiftTask = {
      ...task,
      id: genId('task'),
      date: next.date,
      shiftType: next.type,
      section: task.section ?? 'during',
      carriedOverFrom: task.id,
      createdAt: now.toISOString(),
    };
    db.tasks.push(copy);
    carried.push(copy);
  }
  return carried;
}

export function syncShiftTasks(slot?: ShiftSlot, now: Date = new Date()) {
  const carried = carryOverUnfinishedTasks(now);
  const generated = slot ? ensureTemplateTasks(slot, now) : false;
  if (carried.length || generated) persistMockCollections();
}
