import { http, HttpResponse, delay } from 'msw';
import { db, genId } from '../data/db';
import type { Shift } from '@/types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const shiftsHandlers = [
  http.get(`${API}/shifts`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const weekStart = url.searchParams.get('weekStart');
    let result = db.shifts;
    if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const endStr = end.toISOString().split('T')[0];
      result = db.shifts.filter((s) => s.date >= weekStart && s.date < endStr);
    }
    return HttpResponse.json(result);
  }),

  http.post(`${API}/shifts`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Omit<Shift, 'id'>;
    const shift: Shift = { ...body, id: genId('sh') };
    db.shifts.push(shift);
    return HttpResponse.json(shift, { status: 201 });
  }),

  http.put(`${API}/shifts/:id`, async ({ params, request }) => {
    await delay(250);
    const idx = db.shifts.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const body = (await request.json()) as Omit<Shift, 'id'>;
    db.shifts[idx] = { ...db.shifts[idx], ...body };
    return HttpResponse.json(db.shifts[idx]);
  }),

  http.delete(`${API}/shifts/:id`, async ({ params }) => {
    await delay(200);
    const idx = db.shifts.findIndex((s) => s.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    db.shifts.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

