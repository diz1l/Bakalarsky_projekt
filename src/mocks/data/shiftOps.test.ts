import { describe, expect, test } from 'vitest';
import { db } from './db';
import { carryOverUnfinishedTasks, ensureTemplateTasks } from './shiftTasks';
import { computeHandoverStatus, getExpectedRecipients } from './handover';
import type { HandoverNote, ShiftTask } from '@/types';

const now = new Date(2026, 10, 7, 10, 0); // day shift of 2026-11-07

function task(overrides: Partial<ShiftTask>): ShiftTask {
  return {
    id: 'task-x',
    title: 'Test',
    date: '2026-11-06',
    shiftType: 'NIGHT',
    department: 'Front Desk',
    priority: 'medium',
    status: 'open',
    createdBy: 'usr-2',
    createdByName: 'Sarah Connor',
    createdAt: now.toISOString(),
    ...overrides,
  };
}

describe('shift tasks', () => {
  test('templates generate tasks once per slot', () => {
    db.tasks = [];
    ensureTemplateTasks({ date: '2026-11-07', type: 'NIGHT' }, now);
    const count = db.tasks.length;
    expect(count).toBeGreaterThan(0);
    expect(db.tasks.every((entry) => entry.date === '2026-11-07' && entry.shiftType === 'NIGHT')).toBe(true);
    ensureTemplateTasks({ date: '2026-11-07', type: 'NIGHT' }, now);
    expect(db.tasks).toHaveLength(count);
  });

  test('templates do not fill old history', () => {
    db.tasks = [];
    ensureTemplateTasks({ date: '2026-11-01', type: 'DAY' }, now);
    expect(db.tasks).toHaveLength(0);
  });

  test('unfinished one-off tasks move to the next shift exactly once', () => {
    db.tasks = [task({ id: 'old' }), task({ id: 'done', status: 'done' }), task({ id: 'tpl', templateId: 'tpl-1' })];
    const carried = carryOverUnfinishedTasks(now);
    expect(carried).toHaveLength(1);
    expect(carried[0]).toMatchObject({ carriedOverFrom: 'old', date: '2026-11-07', shiftType: 'DAY' });
    expect(carryOverUnfinishedTasks(now)).toHaveLength(0);
  });
});

describe('shift handover', () => {
  const note: HandoverNote = {
    id: 'hand-x',
    date: '2026-11-07',
    shiftType: 'DAY',
    targetDate: '2026-11-07',
    targetShiftType: 'NIGHT',
    department: 'Housekeeping',
    category: 'rooms',
    priority: 'normal',
    title: 'Test',
    content: 'Test',
    requiresAction: true,
    status: 'open',
    authorId: 'usr-2',
    authorName: 'Sarah Connor',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    acknowledgements: [],
  };

  test('recipients fall back to the department when nobody is scheduled', () => {
    db.shifts = [];
    expect(getExpectedRecipients(note).map((recipient) => recipient.userId)).toEqual(['usr-3']);
  });

  test('requiresAction notes are acknowledged only after action is taken', () => {
    const read: HandoverNote = { ...note, acknowledgements: [{ userId: 'usr-3', userName: 'Mike', readAt: now.toISOString() }] };
    expect(computeHandoverStatus(read)).toBe('open');
    read.acknowledgements[0].actionTakenAt = now.toISOString();
    expect(computeHandoverStatus(read)).toBe('acknowledged');
    expect(computeHandoverStatus({ ...read, resolvedAt: now.toISOString() })).toBe('resolved');
  });
});
