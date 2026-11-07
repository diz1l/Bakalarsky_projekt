import { delay, http, HttpResponse } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import type { Absence } from '@/types';
import { hasPermission } from '@/utils/permissions';
import { API, badRequest, forbidden, getRequestUser, notFound } from './utils';

export const absencesHandlers = [
  http.get(`${API}/absences`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    return HttpResponse.json(
      db.absences.filter((absence) => (!from || absence.date >= from) && (!to || absence.date < to)),
    );
  }),

  http.put(`${API}/absences`, async ({ request }) => {
    await delay(150);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'shifts.create')) return forbidden();

    const body = (await request.json()) as Omit<Absence, 'id'>;
    if (db.shifts.some((shift) => shift.employeeId === body.employeeId && shift.date === body.date)) {
      return badRequest('The employee already has a shift on this day. Remove the shift first.');
    }

    const existing = db.absences.find((entry) => entry.employeeId === body.employeeId && entry.date === body.date);
    if (existing) {
      Object.assign(existing, body);
      persistMockCollections();
      return HttpResponse.json(existing);
    }

    const absence: Absence = { ...body, id: genId('abs') };
    db.absences.push(absence);
    persistMockCollections();
    return HttpResponse.json(absence, { status: 201 });
  }),

  http.delete(`${API}/absences/:id`, async ({ params, request }) => {
    await delay(120);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'shifts.create')) return forbidden();

    const idx = db.absences.findIndex((entry) => entry.id === params.id);
    if (idx === -1) return notFound();
    db.absences.splice(idx, 1);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),
];
