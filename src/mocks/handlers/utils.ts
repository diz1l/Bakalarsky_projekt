import { HttpResponse } from 'msw';
import { db } from '../data/db';

export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const TOKEN_PREFIX = 'Bearer mock-jwt-';

export function getUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith(TOKEN_PREFIX)) return null;
  return authHeader.slice(TOKEN_PREFIX.length) || null;
}

export function getRequestUser(request: Request) {
  const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
  return db.users.find((user) => user.id === userId) ?? null;
}

export function forbidden(message = 'Forbidden') {
  return HttpResponse.json({ message }, { status: 403 });
}

export function notFound() {
  return HttpResponse.json({ message: 'Not found' }, { status: 404 });
}

export function badRequest(message: string) {
  return HttpResponse.json({ message }, { status: 400 });
}
