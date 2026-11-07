import { delay, http, HttpResponse } from 'msw';
import type { AbsenceType, ScheduleRequest } from '@/types';
import { db, genId, persistMockCollections } from '../data/db';
import { notifyEmployee, notifyRoles } from '../data/notificationEvents';
import { API, forbidden, getRequestUser } from './utils';
import { hasPermission } from '@/utils/permissions';

export const scheduleRequestsHandlers = [
  http.get(`${API}/schedule-requests`, async ({ request }) => {
    await delay(120);
    const user = getRequestUser(request);
    if (!user) return forbidden();
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const employee = db.employees.find((entry) => entry.userId === user.id);
    const result = db.scheduleRequests.filter((item) => item.date >= from && item.date < to && (hasPermission(user.role, 'shifts.create') || item.employeeId === employee?.id));
    return HttpResponse.json(result);
  }),
  http.post(`${API}/schedule-requests`, async ({ request }) => {
    await delay(150);
    const user = getRequestUser(request);
    const employee = db.employees.find((entry) => entry.userId === user?.id);
    if (!user || !employee || hasPermission(user.role, 'shifts.create')) return forbidden();
    const body = await request.json() as { date: string; type: AbsenceType };
    const existing = db.scheduleRequests.find((item) => item.employeeId === employee.id && item.date === body.date);
    const item: ScheduleRequest = { id: existing?.id ?? genId('req'), employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, department: employee.department, ...body, status: 'PENDING', createdAt: new Date().toISOString() };
    if (existing) Object.assign(existing, item); else db.scheduleRequests.push(item);
    persistMockCollections();
    notifyRoles(['ADMIN', 'MANAGER'], { title: 'Schedule request', message: `${item.employeeName} requested a schedule change on ${item.date}.`, type: 'info', relatedType: 'shift', relatedId: item.id }, user.id, user.id);
    return HttpResponse.json(item, { status: 201 });
  }),
  http.put(`${API}/schedule-requests/:id/review`, async ({ params, request }) => {
    await delay(150);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'shifts.create')) return forbidden();
    const item = db.scheduleRequests.find((entry) => entry.id === params.id);
    if (!item) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const { decision } = await request.json() as { decision: 'APPROVED' | 'REJECTED' };
    item.status = decision;
    if (decision === 'APPROVED') {
      db.shifts = db.shifts.filter((shift) => shift.employeeId !== item.employeeId || shift.date !== item.date);
      db.absences = db.absences.filter((absence) => absence.employeeId !== item.employeeId || absence.date !== item.date).concat({ id: genId('abs'), employeeId: item.employeeId, date: item.date, type: item.type });
    }
    persistMockCollections();
    notifyEmployee(item.employeeId, { title: `Schedule request ${decision.toLowerCase()}`, message: `Your request for ${item.date} was ${decision.toLowerCase()}.`, type: decision === 'APPROVED' ? 'success' : 'warning', relatedType: 'shift', relatedId: item.id }, user.id);
    return HttpResponse.json(item);
  }),
];
