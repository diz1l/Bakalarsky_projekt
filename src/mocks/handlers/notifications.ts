import { delay, http, HttpResponse } from 'msw';
import { db, persistMockCollections } from '../data/db';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

function getUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.replace('Bearer mock-jwt-', '');
}

export const notificationsHandlers = [
  http.get(`${API}/notifications`, async ({ request }) => {
    await delay(180);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json(db.notifications.filter((item) => item.userId === userId));
  }),

  http.patch(`${API}/notifications/:id/read`, async ({ params, request }) => {
    await delay(120);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
    const item = db.notifications.find((notification) => notification.id === params.id);

    if (!userId || !item || item.userId !== userId) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    item.read = true;
    persistMockCollections();
    return HttpResponse.json(item);
  }),

  http.delete(`${API}/notifications`, async ({ request }) => {
    await delay(120);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    db.notifications = db.notifications.filter((item) => item.userId !== userId);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),
];
