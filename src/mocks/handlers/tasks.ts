import { delay, http, HttpResponse } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import { syncShiftTasks } from '../data/shiftTasks';
import { notifyEmployee } from '../data/notificationEvents';
import type { ShiftTask, ShiftType, TaskTemplate } from '@/types';
import { hasPermission } from '@/utils/permissions';
import { compareSlots, getCurrentSlot, getNextSlot } from '@/utils/shiftUtils';
import { API, badRequest, forbidden, getRequestUser, notFound } from './utils';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

type TaskPayload = Pick<ShiftTask, 'title' | 'date' | 'shiftType' | 'department' | 'priority'> &
  Partial<Pick<ShiftTask, 'description' | 'assigneeId' | 'dueTime'>>;

export const tasksHandlers = [
  http.get(`${API}/tasks`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const shiftType = url.searchParams.get('shiftType') as ShiftType | null;
    const department = url.searchParams.get('department');

    syncShiftTasks(date && shiftType ? { date, type: shiftType } : undefined);

    const result = db.tasks
      .filter((task) => (!date || task.date === date) && (!shiftType || task.shiftType === shiftType))
      .filter((task) => !department || task.department === department || task.department === 'ALL')
      .sort(
        (left, right) =>
          Number(left.status !== 'open') - Number(right.status !== 'open') ||
          PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
          (left.dueTime ?? '99').localeCompare(right.dueTime ?? '99'),
      );
    return HttpResponse.json(result);
  }),

  http.post(`${API}/tasks`, async ({ request }) => {
    await delay(180);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.create')) return forbidden();

    const body = (await request.json()) as TaskPayload;
    if (!body.title?.trim()) return badRequest('Title is required');

    // Employees may plan only for their own and the following shift.
    if (!hasPermission(user.role, 'tasks.manage')) {
      const current = getCurrentSlot();
      const slot = { date: body.date, type: body.shiftType };
      if (compareSlots(slot, current) < 0 || compareSlots(slot, getNextSlot(current)) > 0) {
        return forbidden('Employees can add tasks only for the current or the next shift.');
      }
    }

    const task: ShiftTask = {
      ...body,
      title: body.title.trim(),
      id: genId('task'),
      status: 'open',
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
    };
    db.tasks.push(task);
    persistMockCollections();

    if (task.assigneeId) {
      notifyEmployee(
        task.assigneeId,
        {
          title: 'New shift task',
          message: `${task.title} (${task.date}, ${task.shiftType === 'DAY' ? 'day' : 'night'} shift)`,
          type: task.priority === 'high' ? 'warning' : 'info',
          relatedType: 'task',
          relatedId: task.id,
        },
        user.id,
      );
    }
    return HttpResponse.json(task, { status: 201 });
  }),

  http.patch(`${API}/tasks/:id`, async ({ params, request }) => {
    await delay(140);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.complete')) return forbidden();

    const task = db.tasks.find((entry) => entry.id === params.id);
    if (!task) return notFound();

    const body = (await request.json()) as Partial<ShiftTask>;
    const canManage = hasPermission(user.role, 'tasks.manage');

    if (body.status && body.status !== task.status) {
      if (body.status === 'skipped' && !body.comment?.trim()) return badRequest('A comment is required to skip a task');
      if (body.status === 'open' && task.completedBy && task.completedBy !== user.id && !canManage) {
        return forbidden('Only the person who completed the task or a manager can reopen it.');
      }
      task.status = body.status;
      if (body.status === 'open') {
        delete task.completedBy;
        delete task.completedByName;
        delete task.completedAt;
        delete task.comment;
      } else {
        task.completedBy = user.id;
        task.completedByName = user.name;
        task.completedAt = new Date().toISOString();
        task.comment = body.comment?.trim() || undefined;
      }
    }

    const editable = ['title', 'description', 'priority', 'dueTime', 'assigneeId', 'department'] as const;
    if (editable.some((key) => key in body)) {
      if (!canManage && task.createdBy !== user.id) return forbidden();
      editable.forEach((key) => {
        if (key in body) Object.assign(task, { [key]: body[key] });
      });
    }

    persistMockCollections();
    return HttpResponse.json(task);
  }),

  http.delete(`${API}/tasks/:id`, async ({ params, request }) => {
    await delay(120);
    const user = getRequestUser(request);
    const idx = db.tasks.findIndex((entry) => entry.id === params.id);
    if (idx === -1) return notFound();
    if (!user || !(hasPermission(user.role, 'tasks.manage') || db.tasks[idx].createdBy === user.id)) return forbidden();

    db.tasks.splice(idx, 1);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/task-templates`, async () => {
    await delay(120);
    return HttpResponse.json(db.taskTemplates);
  }),

  http.post(`${API}/task-templates`, async ({ request }) => {
    await delay(160);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.manageTemplates')) return forbidden();

    const body = (await request.json()) as Omit<TaskTemplate, 'id' | 'createdBy'>;
    const template: TaskTemplate = { ...body, id: genId('tpl'), createdBy: user.id };
    db.taskTemplates.push(template);
    persistMockCollections();
    return HttpResponse.json(template, { status: 201 });
  }),

  http.put(`${API}/task-templates/:id`, async ({ params, request }) => {
    await delay(160);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.manageTemplates')) return forbidden();

    const template = db.taskTemplates.find((entry) => entry.id === params.id);
    if (!template) return notFound();
    Object.assign(template, (await request.json()) as Partial<TaskTemplate>, { id: template.id });
    persistMockCollections();
    return HttpResponse.json(template);
  }),

  http.delete(`${API}/task-templates/:id`, async ({ params, request }) => {
    await delay(120);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.manageTemplates')) return forbidden();

    const idx = db.taskTemplates.findIndex((entry) => entry.id === params.id);
    if (idx === -1) return notFound();
    db.taskTemplates.splice(idx, 1);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),
];
