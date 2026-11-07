import type { Absence, Announcement, Employee, HandoverNote, Notification, Shift, ShiftTask, StaffRole, TaskTemplate, User } from '@/types';
import { loadMockState, resetMockState, saveMockState } from './persistence';
import { toDateString } from '@/utils/dateUtils';
import { getCurrentSlot, getNextSlot, getPreviousSlot } from '@/utils/shiftUtils';

export interface MockUser extends User {
  password: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateString(d);
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
    mustChangePassword: true,
    password: 'password123',
  },
  {
    id: 'usr-3',
    login: 'employee',
    email: 'employee@hotel.com',
    name: 'Mike Wilson',
    role: 'EMPLOYEE',
    mustChangePassword: true,
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

const seedAbsences: Absence[] = [
  { id: 'abs-1', employeeId: 'emp-6', date: dateStr(1), type: 'PAID_LEAVE' },
  { id: 'abs-2', employeeId: 'emp-5', date: dateStr(3), type: 'SICK' },
];

const seedTaskTemplates: TaskTemplate[] = [
  {
    id: 'tpl-1',
    title: 'Count the cash register and sign the cash report',
    section: 'end',
    sortOrder: 1,
    shiftType: 'ANY',
    department: 'Front Desk',
    weekdays: [],
    priority: 'high',
    active: true,
    createdBy: 'usr-2',
  },
  {
    id: 'tpl-2',
    title: 'Print tomorrow\'s arrivals list',
    section: 'start',
    sortOrder: 1,
    shiftType: 'ANY',
    department: 'Front Desk',
    weekdays: [],
    dueTime: '23:00',
    priority: 'medium',
    active: true,
    createdBy: 'usr-2',
  },
  {
    id: 'tpl-3',
    title: 'Check that all checked-out rooms are cleaned',
    section: 'during',
    sortOrder: 1,
    shiftType: 'ANY',
    department: 'Housekeeping',
    weekdays: [],
    dueTime: '16:00',
    priority: 'medium',
    active: true,
    createdBy: 'usr-2',
  },
  {
    id: 'tpl-4',
    title: 'Walk through corridors and emergency exits',
    section: 'end',
    sortOrder: 2,
    shiftType: 'ANY',
    department: 'ALL',
    weekdays: [],
    dueTime: '02:00',
    priority: 'low',
    active: true,
    createdBy: 'usr-1',
  },
];

const currentSlot = getCurrentSlot();
const previousSlot = getPreviousSlot(currentSlot);
const nextSlot = getNextSlot(currentSlot);

const seedTasks: ShiftTask[] = [
  {
    id: 'task-1',
    title: 'Call the guest in room 204 about late check-out',
    date: currentSlot.date,
    shiftType: currentSlot.type,
    department: 'Front Desk',
    section: 'during',
    sortOrder: 1,
    priority: 'high',
    status: 'open',
    carriedOverFrom: 'task-0',
    createdBy: 'usr-2',
    createdByName: 'Sarah Connor',
    createdAt: isoAgo(14),
  },
  {
    id: 'task-2',
    title: 'Restock minibar in rooms 301–310',
    date: currentSlot.date,
    shiftType: currentSlot.type,
    department: 'Housekeeping',
    section: 'during',
    sortOrder: 2,
    assigneeId: 'emp-3',
    priority: 'medium',
    status: 'open',
    createdBy: 'usr-2',
    createdByName: 'Sarah Connor',
    createdAt: isoAgo(3),
  },
  {
    id: 'task-3',
    title: 'Prepare welcome package for the VIP guest arriving tomorrow',
    date: nextSlot.date,
    shiftType: nextSlot.type,
    department: 'Front Desk',
    section: 'during',
    sortOrder: 1,
    priority: 'medium',
    status: 'open',
    createdBy: 'usr-3',
    createdByName: 'Mike Wilson',
    createdAt: isoAgo(1),
  },
];

const seedHandoverNotes: HandoverNote[] = [
  {
    id: 'hand-1',
    date: previousSlot.date,
    shiftType: previousSlot.type,
    targetDate: currentSlot.date,
    targetShiftType: currentSlot.type,
    department: 'Maintenance',
    category: 'maintenance',
    priority: 'critical',
    title: 'Water leak in room 312',
    content: 'The bathroom tap in 312 is leaking. The guest was moved to 315. A plumber is booked for 9:00 — please let him in and check the result.',
    requiresAction: true,
    status: 'open',
    authorId: 'usr-2',
    authorName: 'Sarah Connor',
    createdAt: isoAgo(5),
    updatedAt: isoAgo(5),
    acknowledgements: [],
  },
  {
    id: 'hand-2',
    date: previousSlot.date,
    shiftType: previousSlot.type,
    targetDate: currentSlot.date,
    targetShiftType: currentSlot.type,
    department: 'Front Desk',
    category: 'guests',
    priority: 'normal',
    title: 'Room 105 pays at check-out',
    content: 'Mr. Novak (105) will pay the full amount at check-out. Payment is confirmed by the manager.',
    requiresAction: false,
    status: 'acknowledged',
    authorId: 'usr-3',
    authorName: 'Mike Wilson',
    createdAt: isoAgo(6),
    updatedAt: isoAgo(2),
    acknowledgements: [{ userId: 'usr-2', userName: 'Sarah Connor', readAt: isoAgo(2) }],
  },
];

const persistedState = loadMockState();

export const db = {
  users: persistedState.users ? clone(persistedState.users) : clone(seedUsers),
  employees: persistedState.employees ? clone(persistedState.employees) : clone(seedEmployees),
  shifts: persistedState.shifts ? clone(persistedState.shifts) : clone(seedShifts),
  notifications: persistedState.notifications ? clone(persistedState.notifications) : clone(seedNotifications),
  announcements: persistedState.announcements ? clone(persistedState.announcements) : clone(seedAnnouncements),
  absences: persistedState.absences ? clone(persistedState.absences) : clone(seedAbsences),
  scheduleRequests: persistedState.scheduleRequests ? clone(persistedState.scheduleRequests) : [],
  taskTemplates: persistedState.taskTemplates
    ? clone(persistedState.taskTemplates).map((template, index) => ({
      ...template,
      section: template.section ?? 'during',
      sortOrder: template.sortOrder ?? index + 1,
      shiftType: 'ANY' as const,
      weekdays: [],
      active: true,
    }))
    : clone(seedTaskTemplates),
  tasks: persistedState.tasks ? clone(persistedState.tasks) : clone(seedTasks),
  handoverNotes: persistedState.handoverNotes ? clone(persistedState.handoverNotes) : clone(seedHandoverNotes),
};

let nextId = 0;

// Time-based prefix keeps ids unique across reloads, when persisted records are restored.
export function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${(++nextId).toString(36)}`;
}

export function persistMockCollections() {
  saveMockState({
    users: db.users,
    employees: db.employees,
    shifts: db.shifts,
    notifications: db.notifications,
    announcements: db.announcements,
    absences: db.absences,
    scheduleRequests: db.scheduleRequests,
    taskTemplates: db.taskTemplates,
    tasks: db.tasks,
    handoverNotes: db.handoverNotes,
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
  db.absences = clone(seedAbsences);
  db.scheduleRequests = [];
  db.taskTemplates = clone(seedTaskTemplates);
  db.tasks = clone(seedTasks);
  db.handoverNotes = clone(seedHandoverNotes);
  nextId = 0;
  resetMockState();
}
