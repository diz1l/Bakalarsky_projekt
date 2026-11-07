import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { forbidden, notFound, idParam } from '../lib/http.js';
import { notifyEmployee, notifyRoles } from '../lib/notify.js';
import { requirePermission } from '../middleware/auth.js';

export const employeesRouter = Router();

const employeeSchema = z.object({
  userId: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  department: z.string().min(1),
  position: z.string().min(1),
  hireDate: z.string(),
  status: z.enum(['active', 'inactive']),
});

employeesRouter.get('/', requirePermission('employees.view'), async (_req, res) => {
  res.json(await prisma.employee.findMany({ orderBy: { lastName: 'asc' } }));
});

employeesRouter.get('/:id', requirePermission('employees.view'), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: idParam(req) } });
  if (!employee) throw notFound();
  res.json(employee);
});

employeesRouter.post('/', requirePermission('employees.create'), async (req, res) => {
  const data = employeeSchema.parse(req.body);
  if (data.role === 'ADMIN' && req.user!.role !== 'ADMIN') throw forbidden('Only admins can create admins');
  const employee = await prisma.employee.create({ data });
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'Employee added', message: `${employee.firstName} ${employee.lastName} was added to the employee list.`,
    type: 'info', relatedType: 'employee', relatedId: employee.id,
  }, req.user!.id);
  res.status(201).json(employee);
});

employeesRouter.put('/:id', requirePermission('employees.edit'), async (req, res) => {
  const data = employeeSchema.parse(req.body);
  if (data.role === 'ADMIN' && req.user!.role !== 'ADMIN') throw forbidden('Only admins can grant the admin role');
  const employee = await prisma.employee.update({ where: { id: idParam(req) }, data });
  const name = `${employee.firstName} ${employee.lastName}`;
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'Employee updated', message: `${name}'s employee record was updated.`, type: 'info', relatedType: 'employee', relatedId: employee.id,
  }, req.user!.id);
  await notifyEmployee(employee.id, {
    title: 'Employee details updated', message: 'Your employee details were updated by a manager.', type: 'info', relatedType: 'employee', relatedId: employee.id,
  }, req.user!.id);
  res.json(employee);
});

employeesRouter.delete('/:id', requirePermission('employees.delete'), async (req, res) => {
  const employee = await prisma.employee.delete({ where: { id: idParam(req) } });
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'Employee removed', message: `${employee.firstName} ${employee.lastName} was removed from the employee list.`,
    type: 'warning', relatedType: 'employee', relatedId: employee.id,
  }, req.user!.id);
  res.status(204).end();
});
