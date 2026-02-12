import { delay, http, HttpResponse } from 'msw';
import { db } from '../data/db';
import type { ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest, UpdateProfileRequest, User } from '@/types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

function getUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.replace('Bearer mock-jwt-', '');
}

function toUser(entity: { id: string; login: string; email: string; name: string; role: User['role'] }): User {
  return {
    id: entity.id,
    login: entity.login,
    email: entity.email,
    name: entity.name,
    role: entity.role,
  };
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

    await request.json() as ChangePasswordRequest;

    return HttpResponse.json({ message: 'Password updated' });
  }),
];
