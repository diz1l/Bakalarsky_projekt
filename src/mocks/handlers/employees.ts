import { http, HttpResponse, delay } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import { notifyEmployee, notifyRoles } from '../data/notificationEvents';
import type { Employee } from '@/types';
import { API, getRequestUser, getUserIdFromAuthHeader } from './utils';

export const employeesHandlers = [
  http.get(`${API}/employees/me`, async ({ request }) => {
    await delay(100);
    const user = getRequestUser(request);
    const employee = db.employees.find((item) => item.userId === user?.id);
    return HttpResponse.json(employee ? { id: employee.id, userId: employee.userId, firstName: employee.firstName, lastName: employee.lastName, department: employee.department, status: employee.status } : null);
  }),
  http.get(`${API}/employees/roster`, async () => {
    await delay(120);
    return HttpResponse.json(db.employees.filter((employee) => employee.status === 'active').map(({ id, firstName, lastName, department, status }) => ({ id, firstName, lastName, department, status })));
  }),
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
    persistMockCollections();
    const actorId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
    notifyRoles(
      ['ADMIN', 'MANAGER'],
      {
        title: 'Employee added',
        message: `${emp.firstName} ${emp.lastName} was added to the employee list.`,
        type: 'info',
        relatedType: 'employee',
        relatedId: emp.id,
      },
      actorId,
      actorId,
    );
    return HttpResponse.json(emp, { status: 201 });
  }),

  http.put(`${API}/employees/:id`, async ({ params, request }) => {
    await delay(250);
    const idx = db.employees.findIndex((e) => e.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const body = (await request.json()) as Omit<Employee, 'id'>;
    db.employees[idx] = { ...db.employees[idx], ...body };
    persistMockCollections();
    const actorId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
    const updated = db.employees[idx];
    notifyRoles(
      ['ADMIN', 'MANAGER'],
      {
        title: 'Employee updated',
        message: `${updated.firstName} ${updated.lastName}'s employee record was updated.`,
        type: 'info',
        relatedType: 'employee',
        relatedId: updated.id,
      },
      actorId,
      actorId,
    );
    if (updated.userId && updated.userId !== actorId) {
      notifyEmployee(
        updated.id,
        {
          title: 'Employee details updated',
          message: 'Your employee details were updated by a manager.',
          type: 'info',
          relatedType: 'employee',
          relatedId: updated.id,
        },
        actorId,
      );
    }
    return HttpResponse.json(db.employees[idx]);
  }),

  http.delete(`${API}/employees/:id`, async ({ params, request }) => {
    await delay(200);
    const idx = db.employees.findIndex((e) => e.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const [employee] = db.employees.splice(idx, 1);
    persistMockCollections();
    const actorId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
    notifyRoles(
      ['ADMIN', 'MANAGER'],
      {
        title: 'Employee removed',
        message: `${employee.firstName} ${employee.lastName} was removed from the employee list.`,
        type: 'warning',
        relatedType: 'employee',
        relatedId: employee.id,
      },
      actorId,
      actorId,
    );
    return new HttpResponse(null, { status: 204 });
  }),
];
