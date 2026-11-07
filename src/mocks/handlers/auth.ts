import { delay, http, HttpResponse } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import type { ChangePasswordRequest, ForgotPasswordRequest, ManagedAccount, ResetPasswordRequest, StaffRole, UpdateProfileRequest, User } from '@/types';
import { API, getUserIdFromAuthHeader } from './utils';

function toUser(entity: { id: string; login: string; email: string; name: string; role: User['role']; mustChangePassword?: boolean }): User {
  return {
    id: entity.id,
    login: entity.login,
    email: entity.email,
    name: entity.name,
    role: entity.role,
    mustChangePassword: entity.mustChangePassword ?? false,
  };
}

function getAdmin(request: Request) {
  const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
  return db.users.find((user) => user.id === userId && user.role === 'ADMIN');
}

function generateTemporaryPassword() {
  return `Temp-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function getManagedAccounts(): ManagedAccount[] {
  return db.users.flatMap((user) => {
    if (user.role === 'GUEST') return [];
    const employee = db.employees.find((entry) => entry.userId === user.id);
    if (!employee) return [];
    return [{
      id: user.id,
      login: user.login,
      email: user.email,
      name: user.name,
      role: user.role as StaffRole,
      mustChangePassword: user.mustChangePassword ?? false,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    }];
  });
}

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    await delay(250);
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = db.users.find((entry) => entry.email === email && entry.password === password);

    if (!user) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    return HttpResponse.json({
      token: `mock-jwt-${user.id}`,
      user: toUser(user),
    });
  }),

  http.post(`${API}/auth/guest`, async () => {
    await delay(150);

    const guest: User = {
      id: 'usr-guest',
      login: 'guest',
      email: 'guest@hotel.com',
      name: 'Guest User',
      role: 'GUEST',
    };

    return HttpResponse.json({
      token: 'mock-jwt-usr-guest',
      user: guest,
    });
  }),

  http.get(`${API}/auth/me`, async ({ request }) => {
    await delay(120);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (userId === 'usr-guest') {
      return HttpResponse.json({
        id: 'usr-guest',
        login: 'guest',
        email: 'guest@hotel.com',
        name: 'Guest User',
        role: 'GUEST',
      } satisfies User);
    }

    const user = db.users.find((entry) => entry.id === userId);
    if (!user) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json(toUser(user));
  }),

  http.get(`${API}/auth/accounts`, async ({ request }) => {
    await delay(120);
    if (!getAdmin(request)) return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    return HttpResponse.json(getManagedAccounts());
  }),

  http.post(`${API}/auth/accounts`, async ({ request }) => {
    await delay(180);
    const admin = getAdmin(request);
    if (!admin) return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { employeeId, login } = (await request.json()) as { employeeId: string; login: string };
    const employee = db.employees.find((entry) => entry.id === employeeId && entry.status === 'active');
    if (!employee) return HttpResponse.json({ message: 'Active employee not found' }, { status: 404 });
    if (employee.userId) return HttpResponse.json({ message: 'Employee already has an account' }, { status: 409 });
    if (db.users.some((user) => user.email.toLowerCase() === employee.email.toLowerCase() || user.login.toLowerCase() === login.toLowerCase())) {
      return HttpResponse.json({ message: 'Login or email is already in use' }, { status: 409 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = {
      id: genId('usr'),
      login,
      email: employee.email,
      name: `${employee.firstName} ${employee.lastName}`,
      role: employee.role,
      mustChangePassword: true,
      password: temporaryPassword,
    };
    db.users.push(user);
    employee.userId = user.id;
    persistMockCollections();
    return HttpResponse.json(
      { account: getManagedAccounts().find((account) => account.id === user.id), temporaryPassword },
      { status: 201 },
    );
  }),

  http.post(`${API}/auth/accounts/:userId/reset-password`, async ({ params, request }) => {
    await delay(150);
    if (!getAdmin(request)) return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    const user = db.users.find((entry) => entry.id === params.userId && entry.role !== 'GUEST');
    if (!user || user.role === 'ADMIN') return HttpResponse.json({ message: 'Account not found' }, { status: 404 });
    const temporaryPassword = generateTemporaryPassword();
    user.password = temporaryPassword;
    user.mustChangePassword = true;
    persistMockCollections();
    return HttpResponse.json({ temporaryPassword });
  }),

  http.post(`${API}/auth/forgot-password`, async ({ request }) => {
    await delay(300);
    await request.json() as ForgotPasswordRequest;

    return HttpResponse.json({
      message: 'If this email exists, we sent a reset link',
      token: `mock-reset-${Date.now()}`,
    });
  }),

  http.post(`${API}/auth/reset-password`, async ({ request }) => {
    await delay(250);
    const { token } = (await request.json()) as ResetPasswordRequest;

    if (!token.startsWith('mock-reset-')) {
      return HttpResponse.json({ message: 'Invalid token' }, { status: 400 });
    }

    return HttpResponse.json({ message: 'Password reset successful' });
  }),

  http.patch(`${API}/auth/profile`, async ({ request }) => {
    await delay(220);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId || userId === 'usr-guest') {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const existing = db.users.find((entry) => entry.id === userId);
    if (!existing) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await request.json()) as UpdateProfileRequest;

    return HttpResponse.json({
      ...toUser(existing),
      ...payload,
    } satisfies User);
  }),

  http.post(`${API}/auth/change-password`, async ({ request }) => {
    await delay(220);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId || userId === 'usr-guest') {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { oldPassword, newPassword } = (await request.json()) as ChangePasswordRequest;
    const user = db.users.find((entry) => entry.id === userId);
    if (!user || user.password !== oldPassword) {
      return HttpResponse.json({ message: 'Current password is incorrect' }, { status: 400 });
    }
    user.password = newPassword;
    user.mustChangePassword = false;
    persistMockCollections();

    return HttpResponse.json({ message: 'Password updated' });
  }),
];
