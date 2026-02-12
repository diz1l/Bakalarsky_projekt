export type StaffRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type Role = StaffRole | 'GUEST';

export interface User {
  id: string;
  login: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
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

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  department: string;
  notes?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
}

export type NotificationRelatedType = 'employee' | 'shift' | 'announcement' | 'system';

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
  token: string;
}

export interface ResetPasswordRequest {
  token: string;
  oldPassword: string;
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
