import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, resetMockDb } from './db';
import { ensureTemplateTasks } from './shiftTasks';
import { getCurrentSlot, getNextSlot } from '@/utils/shiftUtils';

describe('persistent shift checklist templates', () => {
  beforeEach(() => resetMockDb());
  afterEach(() => resetMockDb());

  it('creates the same ordered checklist item for both shift types regardless of legacy weekday settings', () => {
    const template = db.taskTemplates[0];
    Object.assign(template, {
      shiftType: 'DAY',
      weekdays: [1],
      section: 'start',
      sortOrder: 7,
    });

    const current = getCurrentSlot();
    const next = getNextSlot(current);
    expect(ensureTemplateTasks(current)).toBe(true);
    expect(ensureTemplateTasks(next)).toBe(true);

    const generated = db.tasks.filter((task) => task.templateId === template.id);
    expect(generated).toHaveLength(2);
    expect(generated.map(({ shiftType }) => shiftType).sort()).toEqual([current.type, next.type].sort());
    expect(generated.map(({ section, sortOrder, title }) => ({ section, sortOrder, title }))).toEqual([
      { section: 'start', sortOrder: 7, title: template.title },
      { section: 'start', sortOrder: 7, title: template.title },
    ]);
  });
});
