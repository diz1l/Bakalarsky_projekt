import { delay, http, HttpResponse } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import type { Announcement } from '@/types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

function getUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.replace('Bearer mock-jwt-', '');
}

export const announcementsHandlers = [
  http.get(`${API}/announcements`, async () => {
    await delay(180);
    return HttpResponse.json(db.announcements);
  }),

  http.post(`${API}/announcements`, async ({ request }) => {
    await delay(220);
    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization'));
    const user = db.users.find((entry) => entry.id === userId);

    const body = (await request.json()) as Pick<Announcement, 'title' | 'content' | 'priority'>;

    const announcement: Announcement = {
      ...body,
      id: genId('ann'),
      authorId: userId ?? 'unknown',
      authorName: user?.name ?? 'Unknown',
      createdAt: new Date().toISOString(),
      completed: false,
    };

    db.announcements.unshift(announcement);
    persistMockCollections();
    return HttpResponse.json(announcement, { status: 201 });
  }),

  http.patch(`${API}/announcements/:id`, async ({ params, request }) => {
    await delay(160);
    const idx = db.announcements.findIndex((entry) => entry.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const userId = getUserIdFromAuthHeader(request.headers.get('Authorization')) ?? 'unknown';
    const { completed } = (await request.json()) as { completed: boolean };

    db.announcements[idx] = {
      ...db.announcements[idx],
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      completedBy: completed ? userId : undefined,
    };

    persistMockCollections();
    return HttpResponse.json(db.announcements[idx]);
  }),

  http.delete(`${API}/announcements/:id`, async ({ params }) => {
    await delay(150);
    const idx = db.announcements.findIndex((entry) => entry.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    db.announcements.splice(idx, 1);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),
];
