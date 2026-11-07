import { HttpResponse } from 'msw';
import { db } from '../data/db';

export { API_BASE_URL as API } from '@/app/apiConfig';

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
