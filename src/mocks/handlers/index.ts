import { authHandlers } from './auth';
import { employeesHandlers } from './employees';
import { shiftsHandlers } from './shifts';
import { notificationsHandlers } from './notifications';
import { announcementsHandlers } from './announcements';

export const handlers = [
  ...authHandlers,
  ...employeesHandlers,
  ...shiftsHandlers,
  ...notificationsHandlers,
  ...announcementsHandlers,
];
