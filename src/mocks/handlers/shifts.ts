import { http, HttpResponse, delay } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import { notifyEmployee, notifyRoles } from '../data/notificationEvents';
import { addDays, hasTimeOverlap } from '@/utils/dateUtils';
import { getShiftTimes, getShiftType } from '@/utils/shiftUtils';
import type { Shift } from '@/types';
import { API, getUserIdFromAuthHeader } from './utils';

export const shiftsHandlers = [
  http.get(`${API}/shifts`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const weekStart = url.searchParams.get('weekStart');
    const endDate = url.searchParams.get('endDate');
    let result = db.shifts;
    if (weekStart) {
      const endStr = endDate || addDays(weekStart, 7);
      result = db.shifts.filter((s) => s.date >= weekStart && s.date < endStr);
    }
    return HttpResponse.json(result);
  }),

  http.post(`${API}/shifts`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Omit<Shift, 'id'>;
    const shift: Shift = { ...body, type: getShiftType(body), id: genId('sh') };
    db.shifts.push(shift);
    db.absences = db.absences.filter((absence) => absence.employeeId !== shift.employeeId || absence.date !== shift.date);
    persistMockCollections();
    const actorId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
    notifyEmployee(
      shift.employeeId,
      {
        title: 'New shift assigned',
        message: `You have a shift on ${describeShift(shift)}.`,
        type: 'info',
        relatedType: 'shift',
        relatedId: shift.id,
      },
      actorId,
    );
    notifyShiftConflict(shift, actorId);
    return HttpResponse.json(shift, { status: 201 });
  }),

  http.put(`${API}/shifts/:id`, async ({ params, request }) => {
    await delay(250);
    const idx = db.shifts.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const previous = db.shifts[idx];
    const body = (await request.json()) as Omit<Shift, 'id'>;
    db.shifts[idx] = { ...db.shifts[idx], ...body, type: getShiftType(body) };
    persistMockCollections();
    const updated = db.shifts[idx];
    const actorId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (previous.employeeId !== updated.employeeId) {
      notifyEmployee(
        previous.employeeId,
        {
          title: 'Shift reassigned',
          message: `Your shift on ${describeShift(previous)} was reassigned.`,
          type: 'warning',
          relatedType: 'shift',
          relatedId: updated.id,
        },
        actorId,
      );
    }

    const shiftChanged =
      previous.employeeId !== updated.employeeId ||
      previous.date !== updated.date ||
      previous.startTime !== updated.startTime ||
      previous.endTime !== updated.endTime ||
      previous.type !== updated.type ||
      previous.department !== updated.department ||
      previous.status !== updated.status;
    if (shiftChanged) {
      notifyEmployee(
        updated.employeeId,
        {
          title: 'Shift updated',
          message: `Your shift is now scheduled for ${describeShift(updated)}.`,
          type: 'info',
          relatedType: 'shift',
          relatedId: updated.id,
        },
        actorId,
      );
    }

    notifyShiftConflict(updated, actorId);
    return HttpResponse.json(db.shifts[idx]);
  }),

  http.delete(`${API}/shifts/:id`, async ({ params, request }) => {
    await delay(200);
    const idx = db.shifts.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const [shift] = db.shifts.splice(idx, 1);
    persistMockCollections();
    notifyEmployee(
      shift.employeeId,
      {
        title: 'Shift cancelled',
        message: `Your shift on ${describeShift(shift)} was cancelled.`,
        type: 'warning',
        relatedType: 'shift',
        relatedId: shift.id,
      },
      getUserIdFromAuthHeader(request.headers.get('Authorization')),
    );
    return new HttpResponse(null, { status: 204 });
  }),
];

function describeShift(shift: Shift) {
  const { start, end } = getShiftTimes(shift);
  const label = getShiftType(shift) === 'NIGHT' ? 'night shift' : 'day shift';
  return `${shift.date} (${label}, ${start}–${end})`;
}

function notifyShiftConflict(shift: Shift, actorId: string | null) {
  const times = getShiftTimes(shift);
  const conflictExists = db.shifts.some((other) => {
    if (other.id === shift.id || other.employeeId !== shift.employeeId || other.date !== shift.date) return false;
    const otherTimes = getShiftTimes(other);
    return hasTimeOverlap(times.start, times.end, otherTimes.start, otherTimes.end);
  });
  if (!conflictExists) return;

  notifyRoles(
    ['ADMIN', 'MANAGER'],
    {
      title: 'Shift conflict detected',
      message: `${shift.employeeName} has overlapping shifts on ${shift.date}.`,
      type: 'warning',
      relatedType: 'shift',
      relatedId: shift.id,
    },
    actorId,
    actorId,
  );
}
