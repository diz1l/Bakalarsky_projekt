import { http, HttpResponse, delay } from 'msw';
import { db, genId } from '../data/db';
import type { Employee } from '@/types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const employeesHandlers = [
  http.get(`${API}/employees`, async () => {
    await delay(200);
    return HttpResponse.json(db.employees);
  }),

  http.get(`${API}/employees/:id`, async ({ params }) => {
    await delay(150);
    const emp = db.employees.find((e) => e.id === params.id);
    if (!emp) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(emp);
  }),

  http.post(`${API}/employees`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Omit<Employee, 'id'>;
    const emp: Employee = { ...body, id: genId('emp') };
    db.employees.push(emp);
    return HttpResponse.json(emp, { status: 201 });
  }),

  http.put(`${API}/employees/:id`, async ({ params, request }) => {
    await delay(250);
    const idx = db.employees.findIndex((e) => e.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const body = (await request.json()) as Omit<Employee, 'id'>;
    db.employees[idx] = { ...db.employees[idx], ...body };
    return HttpResponse.json(db.employees[idx]);
  }),

  http.delete(`${API}/employees/:id`, async ({ params }) => {
    await delay(200);
    const idx = db.employees.findIndex((e) => e.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    db.employees.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

