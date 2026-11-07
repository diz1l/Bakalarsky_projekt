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
  Partial<Pick<ShiftTask, 'section' | 'sortOrder'>> &
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
      section: body.section ?? 'during',
      sortOrder: body.sortOrder ?? 0,
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

  http.patch(`${API}/tasks/bulk`, async ({ request }) => {
    await delay(140);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.complete')) return forbidden();

    const body = (await request.json()) as { ids?: string[]; status?: 'open' | 'done' };
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 500
      || new Set(body.ids).size !== body.ids.length || !['open', 'done'].includes(body.status ?? '')) {
      return badRequest('Choose one or more tasks and a valid checklist status.');
    }

    const tasks = body.ids.map((id) => db.tasks.find((task) => task.id === id));
    if (tasks.some((task) => !task)) return notFound();
    const canManage = hasPermission(user.role, 'tasks.manage');
    if (body.status === 'open' && tasks.some((task) => task?.completedBy && task.completedBy !== user.id && !canManage)) {
      return forbidden('Only the person who completed a task or a manager can reopen it.');
    }

    const completedAt = new Date().toISOString();
    for (const task of tasks) {
      if (!task) continue;
      task.status = body.status!;
      if (body.status === 'done') {
        task.completedBy = user.id;
        task.completedByName = user.name;
        task.completedAt = completedAt;
        delete task.comment;
      } else {
        delete task.completedBy;
        delete task.completedByName;
        delete task.completedAt;
        delete task.comment;
      }
    }
    persistMockCollections();
    return HttpResponse.json({ updated: tasks.length });
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
    const sectionOrder = { start: 0, during: 1, end: 2 };
    return HttpResponse.json([...db.taskTemplates].sort((left, right) =>
      sectionOrder[left.section] - sectionOrder[right.section] || left.sortOrder - right.sortOrder));
  }),

  http.post(`${API}/task-templates`, async ({ request }) => {
    await delay(160);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.manageTemplates')) return forbidden();

    const body = (await request.json()) as Partial<TaskTemplate>;
    const template: TaskTemplate = {
      ...body,
      section: body.section ?? 'during',
      sortOrder: body.sortOrder ?? 0,
      shiftType: 'ANY',
      weekdays: [],
      active: true,
      id: genId('tpl'),
      createdBy: user.id,
      title: body.title?.trim() ?? '',
      department: body.department ?? 'ALL',
      priority: body.priority ?? 'medium',
    };
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
    const body = (await request.json()) as Partial<TaskTemplate>;
    Object.assign(template, body, {
      id: template.id,
      section: body.section ?? template.section,
      sortOrder: body.sortOrder ?? template.sortOrder,
      shiftType: 'ANY',
      weekdays: [],
      active: true,
    });
    const current = getCurrentSlot();
    db.tasks.forEach((task) => {
      if (task.templateId !== template.id || compareSlots({ date: task.date, type: task.shiftType }, current) < 0) return;
      Object.assign(task, {
        title: template.title,
        description: template.description,
        section: template.section,
        sortOrder: template.sortOrder,
        department: template.department,
        priority: template.priority,
        dueTime: template.dueTime,
      });
    });
    persistMockCollections();
    return HttpResponse.json(template);
  }),

  http.delete(`${API}/task-templates/:id`, async ({ params, request }) => {
    await delay(120);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'tasks.manageTemplates')) return forbidden();

    const idx = db.taskTemplates.findIndex((entry) => entry.id === params.id);
    if (idx === -1) return notFound();
    const current = getCurrentSlot();
    db.tasks = db.tasks.filter((task) =>
      task.templateId !== params.id
      || compareSlots({ date: task.date, type: task.shiftType }, current) < 0);
    db.taskTemplates.splice(idx, 1);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),
];
