// Demo data matching the frontend mock accounts (password: password123).
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const accounts = [
    { id: 'usr-1', login: 'admin', email: 'admin@hotel.com', name: 'John Admin', role: 'ADMIN', mustChangePassword: false },
    { id: 'usr-2', login: 'manager', email: 'manager@hotel.com', name: 'Sarah Connor', role: 'MANAGER', mustChangePassword: true },
    { id: 'usr-3', login: 'employee', email: 'employee@hotel.com', name: 'Mike Wilson', role: 'EMPLOYEE', mustChangePassword: true },
  ];
  for (const account of accounts) {
    await prisma.user.upsert({ where: { id: account.id }, update: { mustChangePassword: account.mustChangePassword }, create: { ...account, passwordHash } });
  }

  const employees = [
    { id: 'emp-1', userId: 'usr-1', firstName: 'John', lastName: 'Admin', email: 'admin@hotel.com', role: 'ADMIN', department: 'Management', position: 'General Manager' },
    { id: 'emp-2', userId: 'usr-2', firstName: 'Sarah', lastName: 'Connor', email: 'manager@hotel.com', role: 'MANAGER', department: 'Front Desk', position: 'Front Desk Manager' },
    { id: 'emp-3', userId: 'usr-3', firstName: 'Mike', lastName: 'Wilson', email: 'employee@hotel.com', role: 'EMPLOYEE', department: 'Housekeeping', position: 'Room Attendant' },
    { id: 'emp-4', firstName: 'Lisa', lastName: 'Chen', email: 'lisa@hotel.com', role: 'EMPLOYEE', department: 'Front Desk', position: 'Receptionist' },
    { id: 'emp-5', firstName: 'Tom', lastName: 'Brown', email: 'tom@hotel.com', role: 'EMPLOYEE', department: 'Restaurant', position: 'Waiter' },
  ];
  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { id: employee.id },
      update: {},
      create: { ...employee, phone: '+420 600 000 000', hireDate: '2024-01-15', status: 'active' },
    });
  }

  const templates = [
    { id: 'tpl-1', title: 'Count the cash register and sign the cash report', shiftType: 'ANY', department: 'Front Desk', priority: 'high' },
    { id: 'tpl-2', title: "Print tomorrow's arrivals list", shiftType: 'NIGHT', department: 'Front Desk', priority: 'medium', dueTime: '23:00' },
    { id: 'tpl-3', title: 'Check that all checked-out rooms are cleaned', shiftType: 'DAY', department: 'Housekeeping', priority: 'medium', dueTime: '16:00' },
  ];
  for (const template of templates) {
    await prisma.taskTemplate.upsert({ where: { id: template.id }, update: {}, create: { ...template, createdBy: 'usr-2' } });
  }
}

main().finally(() => prisma.$disconnect());
