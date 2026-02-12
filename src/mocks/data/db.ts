import type { Announcement, Employee, Notification, Shift, StaffRole, User } from '@/types';
import { loadMockState, resetMockState, saveMockState } from './persistence';

export interface MockUser extends User {
  password: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

const seedUsers: MockUser[] = [
  {
    id: 'usr-1',
    login: 'admin',
    email: 'admin@hotel.com',
    name: 'John Admin',
    role: 'ADMIN',
    password: 'password123',
  },
  {
    id: 'usr-2',
    login: 'manager',
    email: 'manager@hotel.com',
    name: 'Sarah Connor',
    role: 'MANAGER',
    password: 'password123',
  },
  {
    id: 'usr-3',
    login: 'employee',
    email: 'employee@hotel.com',
    name: 'Mike Wilson',
    role: 'EMPLOYEE',
    password: 'password123',
  },
];

const seedEmployees: Employee[] = [
  {
    id: 'emp-1',
    userId: 'usr-1',
    firstName: 'John',
    lastName: 'Admin',
    email: 'admin@hotel.com',
    phone: '+1-555-0101',
    role: 'ADMIN',
    department: 'Management',
    position: 'General Manager',
    hireDate: '2020-01-15',
    status: 'active',
  },
  {
    id: 'emp-2',
    userId: 'usr-2',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'manager@hotel.com',
    phone: '+1-555-0102',
    role: 'MANAGER',
    department: 'Front Desk',
    position: 'Front Desk Manager',
    hireDate: '2021-03-20',
    status: 'active',
  },
  {
    id: 'emp-3',
    userId: 'usr-3',
    firstName: 'Mike',
    lastName: 'Wilson',
    email: 'employee@hotel.com',
    phone: '+1-555-0103',
    role: 'EMPLOYEE',
    department: 'Housekeeping',
    position: 'Housekeeper',
    hireDate: '2022-06-01',
    status: 'active',
  },
  {
    id: 'emp-4',
    firstName: 'Lisa',
    lastName: 'Chen',
    email: 'lisa@hotel.com',
    phone: '+1-555-0104',
    role: 'EMPLOYEE',
    department: 'Front Desk',
    position: 'Receptionist',
    hireDate: '2022-09-15',
    status: 'active',
  },
  {
    id: 'emp-5',
    firstName: 'Tom',
    lastName: 'Brown',
    email: 'tom@hotel.com',
    phone: '+1-555-0105',
    role: 'EMPLOYEE',
    department: 'Restaurant',
    position: 'Waiter',
    hireDate: '2023-01-10',
    status: 'active',
  },
  {
    id: 'emp-6',
    firstName: 'Anna',
    lastName: 'Garcia',
    email: 'anna@hotel.com',
    phone: '+1-555-0106',
    role: 'EMPLOYEE',
    department: 'Housekeeping',
    position: 'Housekeeper',
    hireDate: '2023-04-01',
    status: 'inactive',
  },
];

const seedShifts: Shift[] = [
  {
    id: 'sh-1',
    employeeId: 'emp-2',
    employeeName: 'Sarah Connor',
    date: dateStr(0),
    startTime: '07:00',
    endTime: '15:00',
    department: 'Front Desk',
    status: 'scheduled',
  },
  {
    id: 'sh-2',
    employeeId: 'emp-3',
    employeeName: 'Mike Wilson',
    date: dateStr(0),
    startTime: '08:00',
    endTime: '16:00',
    department: 'Housekeeping',
    status: 'scheduled',
  },
  {
    id: 'sh-3',
    employeeId: 'emp-4',
    employeeName: 'Lisa Chen',
    date: dateStr(0),
    startTime: '15:00',
    endTime: '23:00',
    department: 'Front Desk',
    status: 'scheduled',
  },
  {
    id: 'sh-4',
    employeeId: 'emp-5',
    employeeName: 'Tom Brown',
    date: dateStr(0),
    startTime: '11:00',
    endTime: '19:00',
    department: 'Restaurant',
    status: 'scheduled',
  },
  {
    id: 'sh-5',
    employeeId: 'emp-2',
    employeeName: 'Sarah Connor',
    date: dateStr(1),
    startTime: '07:00',
    endTime: '15:00',
    department: 'Front Desk',
    status: 'scheduled',
  },
  {
    id: 'sh-6',
    employeeId: 'emp-3',
    employeeName: 'Mike Wilson',
    date: dateStr(1),
    startTime: '08:00',
    endTime: '16:00',
    department: 'Housekeeping',
    status: 'scheduled',
  },
  {
    id: 'sh-7',
    employeeId: 'emp-5',
    employeeName: 'Tom Brown',
    date: dateStr(1),
    startTime: '11:00',
    endTime: '19:00',
    department: 'Restaurant',
    status: 'scheduled',
  },
  {
    id: 'sh-8',
    employeeId: 'emp-4',
    employeeName: 'Lisa Chen',
    date: dateStr(2),
    startTime: '07:00',
    endTime: '15:00',
    department: 'Front Desk',
    status: 'scheduled',
  },
  {
    id: 'sh-9',
    employeeId: 'emp-3',
    employeeName: 'Mike Wilson',
    date: dateStr(-1),
    startTime: '08:00',
    endTime: '16:00',
    department: 'Housekeeping',
    status: 'completed',
  },
  {
    id: 'sh-10',
    employeeId: 'emp-2',
    employeeName: 'Sarah Connor',
    date: dateStr(-1),
    startTime: '07:00',
    endTime: '15:00',
    department: 'Front Desk',
    status: 'completed',
  },
];

const seedNotifications: Notification[] = [
  {
    id: 'not-1',
    userId: 'usr-1',
    title: 'New Employee',
    message: 'Anna Garcia has been added to the system.',
    type: 'info',
    read: false,
    createdAt: isoAgo(2),
    senderName: 'HR Team',
    senderEmail: 'hr@hotel.com',
    relatedType: 'employee',
    relatedId: 'emp-6',
  },
  {
    id: 'not-2',
    userId: 'usr-1',
    title: 'Shift Conflict',
    message: 'Overlapping shift detected for Lisa Chen on Friday.',
    type: 'warning',
    read: false,
    createdAt: isoAgo(5),
    senderName: 'Scheduler Bot',
    senderEmail: 'scheduler@hotel.com',
    relatedType: 'shift',
    relatedId: 'sh-8',
  },
  {
    id: 'not-3',
    userId: 'usr-1',
    title: 'Attendance Alert',
    message: 'Mike Wilson checked in late today.',
    type: 'warning',
    read: true,
    createdAt: isoAgo(8),
    senderName: 'Operations',
    senderEmail: 'ops@hotel.com',
    relatedType: 'employee',
    relatedId: 'emp-3',
  },
  {
    id: 'not-4',
    userId: 'usr-2',
    title: 'Schedule Published',
    message: 'Next week\'s schedule has been published.',
    type: 'success',
    read: false,
    createdAt: isoAgo(1),
    senderName: 'Admin Office',
    senderEmail: 'admin.office@hotel.com',
    relatedType: 'shift',
    relatedId: 'sh-5',
  },
  {
    id: 'not-5',
    userId: 'usr-3',
    title: 'Shift Assigned',
    message: 'You have a new shift on Monday 07:00-15:00.',
    type: 'info',
    read: false,
    createdAt: isoAgo(3),
    senderName: 'Front Desk Manager',
    senderEmail: 'manager@hotel.com',
    relatedType: 'shift',
    relatedId: 'sh-5',
  },
  {
    id: 'not-6',
    userId: 'usr-3',
    title: 'Announcement',
    message: 'Staff meeting this Friday at 4 PM.',
    type: 'info',
    read: true,
    createdAt: isoAgo(24),
    senderName: 'John Admin',
    senderEmail: 'admin@hotel.com',
    relatedType: 'announcement',
    relatedId: 'ann-1',
  },
  {
    id: 'not-7',
    userId: 'usr-guest',
    title: 'Guest Mode',
    message: 'You are browsing in guest mode with limited permissions.',
    type: 'info',
    read: false,
    createdAt: isoAgo(1),
    senderName: 'System',
    senderEmail: 'noreply@hotel.com',
    relatedType: 'system',
  },
];

const seedAnnouncements: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Staff Meeting',
    content:
      'There will be a mandatory staff meeting this Friday at 4 PM in the conference room. Please ensure your shifts are covered.',
    authorId: 'usr-1',
    authorName: 'John Admin',
    priority: 'high',
    createdAt: isoAgo(24),
    completed: false,
  },
  {
    id: 'ann-2',
    title: 'New Uniform Policy',
    content:
      'Starting next month, all front desk staff must wear the new uniform. Please pick up your uniforms from the HR office.',
    authorId: 'usr-2',
    authorName: 'Sarah Connor',
    priority: 'medium',
    createdAt: isoAgo(72),
    completed: false,
  },
  {
    id: 'ann-3',
    title: 'Holiday Schedule',
    content:
      'The holiday schedule for December has been posted. Please check your shifts and request changes before November 15.',
    authorId: 'usr-1',
    authorName: 'John Admin',
    priority: 'low',
    createdAt: isoAgo(120),
    completed: false,
  },
];

const persistedState = loadMockState();

export const db = {
  users: clone(seedUsers),
  employees: clone(seedEmployees),
  shifts: clone(seedShifts),
  notifications: persistedState.notifications ? clone(persistedState.notifications) : clone(seedNotifications),
  announcements: persistedState.announcements ? clone(persistedState.announcements) : clone(seedAnnouncements),
};

let nextId = 100;

export function genId(prefix: string) {
  return `${prefix}-${++nextId}`;
}

export function persistMockCollections() {
  saveMockState({
    notifications: db.notifications,
    announcements: db.announcements,
  });
}

export function resolveEmployeeRole(role: StaffRole | 'GUEST'): StaffRole {
  return role === 'GUEST' ? 'EMPLOYEE' : role;
}

export function resetMockDb() {
  db.users = clone(seedUsers);
  db.employees = clone(seedEmployees);
  db.shifts = clone(seedShifts);
  db.notifications = clone(seedNotifications);
  db.announcements = clone(seedAnnouncements);
  nextId = 100;
  resetMockState();
}
