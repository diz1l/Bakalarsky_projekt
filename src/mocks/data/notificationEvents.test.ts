import { describe, expect, test } from 'vitest';
import { db, resetMockDb } from './db';
import { notifyEmployee, notifyRoles } from './notificationEvents';
import type { Notification } from '@/types';

const API = 'http://localhost:3000/api';

async function getNotifications(userId: string): Promise<Notification[]> {
  const response = await fetch(`${API}/notifications`, {
    headers: { Authorization: `Bearer mock-jwt-${userId}` },
  });
  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new Error(`Expected notifications for ${userId}; received HTTP ${response.status}`);
  }
  return body as Notification[];
}

const content = {
  title: 'Test notification',
  message: 'A schedule change needs attention.',
  type: 'info' as const,
  relatedType: 'shift' as const,
  relatedId: 'sh-test',
};

describe('mock notification delivery', () => {
  test('delivers an employee event only to the account linked to that employee', () => {
    resetMockDb();

    notifyEmployee('emp-3', content, 'usr-1');

    const delivered = db.notifications.filter((item) => item.title === content.title);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({
      userId: 'usr-3',
      read: false,
      senderName: 'John Admin',
      relatedType: 'shift',
      relatedId: 'sh-test',
    });
  });

  test('delivers management events to admins and managers, excluding the actor', () => {
    resetMockDb();

    notifyRoles(['ADMIN', 'MANAGER'], content, 'usr-2', 'usr-3');

    expect(db.notifications.filter((item) => item.title === content.title).map((item) => item.userId)).toEqual([
      'usr-1',
    ]);
  });

  test('does not deliver personal employee notifications without a linked account', () => {
    resetMockDb();

    notifyEmployee('emp-4', content, 'usr-1');

    expect(db.notifications.some((item) => item.title === content.title)).toBe(false);
  });

  test('sends an assignment to the employee and a conflict warning to other managers', async () => {
    resetMockDb();
    const existingShift = db.shifts.find((shift) => shift.employeeId === 'emp-3');
    expect(existingShift).toBeDefined();

    const response = await fetch(`${API}/shifts`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock-jwt-usr-2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId: 'emp-3',
        employeeName: 'Mike Wilson',
        date: existingShift?.date,
        startTime: '10:00',
        endTime: '18:00',
        department: 'Housekeeping',
        status: 'scheduled',
      }),
    });
    expect(response.status).toBe(201);

    const employeeNotifications = await getNotifications('usr-3');
    const adminNotifications = await getNotifications('usr-1');
    const managerNotifications = await getNotifications('usr-2');

    expect(employeeNotifications.some((item) => item.title === 'New shift assigned')).toBe(true);
    expect(adminNotifications.some((item) => item.title === 'Shift conflict detected')).toBe(true);
    expect(managerNotifications.some((item) => item.title === 'Shift conflict detected')).toBe(false);
  });

  test('broadcasts a new announcement to other staff accounts, not its author', async () => {
    resetMockDb();

    const response = await fetch(`${API}/announcements`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock-jwt-usr-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'All hands',
        content: 'Please attend the team meeting.',
        priority: 'high',
      }),
    });
    expect(response.status).toBe(201);

    const adminNotifications = await getNotifications('usr-1');
    const managerNotifications = await getNotifications('usr-2');
    const employeeNotifications = await getNotifications('usr-3');

    expect(adminNotifications.some((item) => item.message === 'All hands')).toBe(false);
    expect(managerNotifications.some((item) => item.message === 'All hands')).toBe(true);
    expect(employeeNotifications.some((item) => item.message === 'All hands')).toBe(true);
  });
});
