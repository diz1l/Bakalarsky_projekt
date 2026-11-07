import { authHandlers } from './auth';
import { employeesHandlers } from './employees';
import { shiftsHandlers } from './shifts';
import { notificationsHandlers } from './notifications';
import { announcementsHandlers } from './announcements';
import { absencesHandlers } from './absences';
import { tasksHandlers } from './tasks';
import { handoverHandlers } from './handover';
import { scheduleRequestsHandlers } from './scheduleRequests';

export const handlers = [
  ...authHandlers,
  ...employeesHandlers,
  ...shiftsHandlers,
  ...notificationsHandlers,
  ...announcementsHandlers,
  ...absencesHandlers,
  ...tasksHandlers,
  ...handoverHandlers,
  ...scheduleRequestsHandlers,
];
