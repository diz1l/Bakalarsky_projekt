export type StaffRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type Role = StaffRole | 'GUEST';

export interface User {
  id: string;
  login: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword?: boolean;
  avatar?: string;
}

export interface ManagedAccount {
  id: string;
  login: string;
  email: string;
  name: string;
  role: StaffRole;
  mustChangePassword: boolean;
  employeeId: string;
  employeeName: string;
}

export interface Employee {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffRole;
  department: string;
  position: string;
  hireDate: string;
  status: 'active' | 'inactive';
}

export type ShiftType = 'DAY' | 'NIGHT';

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type?: ShiftType;
  startTime: string;
  endTime: string;
  department: string;
  notes?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
}

export type NotificationRelatedType = 'employee' | 'shift' | 'announcement' | 'task' | 'handover' | 'system';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  createdAt: string;
  senderName: string;
  senderEmail: string;
  relatedType?: NotificationRelatedType;
  relatedId?: string;
}

export type AbsenceType = 'PAID_LEAVE' | 'SICK' | 'UNAVAILABLE';

export interface Absence {
  id: string;
  employeeId: string;
  date: string;
  type: AbsenceType;
  note?: string;
}

export interface ScheduleRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  type: AbsenceType;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'open' | 'done' | 'skipped';

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  shiftType: ShiftType | 'ANY';
  department: string;
  weekdays: number[];
  dueTime?: string;
  priority: TaskPriority;
  active: boolean;
  createdBy: string;
}

export interface ShiftTask {
  id: string;
  templateId?: string;
  title: string;
  description?: string;
  date: string;
  shiftType: ShiftType;
  department: string;
  assigneeId?: string;
  priority: TaskPriority;
  dueTime?: string;
  status: TaskStatus;
  carriedOverFrom?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  completedBy?: string;
  completedByName?: string;
  completedAt?: string;
  comment?: string;
}

export type HandoverCategory = 'guests' | 'rooms' | 'maintenance' | 'cash' | 'security' | 'other';
export type HandoverPriority = 'normal' | 'important' | 'critical';
export type HandoverStatus = 'open' | 'acknowledged' | 'resolved';

export interface HandoverAck {
  userId: string;
  userName: string;
  readAt: string;
  actionTakenAt?: string;
  comment?: string;
}

export interface HandoverNote {
  id: string;
  date: string;
  shiftType: ShiftType;
  targetDate: string;
  targetShiftType: ShiftType;
  department: string;
  category: HandoverCategory;
  priority: HandoverPriority;
  title: string;
  content: string;
  requiresAction: boolean;
  status: HandoverStatus;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  acknowledgements: HandoverAck[];
  resolvedBy?: string;
  resolvedAt?: string;
  expectedRecipients?: { userId: string; name: string }[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  token?: string;
}

export interface ResetPasswordRequest {
  token: string;
  oldPassword?: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  name: string;
  login: string;
  email: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}
