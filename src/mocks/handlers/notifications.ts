import { delay, http, HttpResponse } from 'msw';
import { db, persistMockCollections } from '../data/db';
import { API, getUserIdFromAuthHeader } from './utils';

export const notificationsHandlers = [
  http.get(`${API}/notifications`, async ({ request }) => {
    await delay(180);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json(
      db.notifications
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }),

  http.patch(`${API}/notifications/read-all`, async ({ request }) => {
    await delay(120);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));

    if (!userId) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const updated = db.notifications.filter((item) => item.userId === userId && !item.read);
    updated.forEach((item) => {
      item.read = true;
    });
    if (updated.length) persistMockCollections();
    return HttpResponse.json(updated);
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
