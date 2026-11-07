import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './lib/http.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { employeesRouter } from './routes/employees.js';
import { absencesRouter, shiftsRouter } from './routes/shifts.js';
import { notificationsRouter } from './routes/notifications.js';
import { announcementsRouter } from './routes/announcements.js';
import { taskTemplatesRouter, tasksRouter } from './routes/tasks.js';
import { handoverRouter } from './routes/handover.js';
import { getCurrentSlot, getNextSlot } from './lib/shiftSlots.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => void res.json({ ok: true }));
  api.use('/auth', authRouter);
  api.use(requireAuth);
  api.get('/shift-slots/current', (_req, res) => {
    const current = getCurrentSlot();
    res.json({ ...current, next: getNextSlot(current) });
  });
  api.use('/employees', employeesRouter);
  api.use('/shifts', shiftsRouter);
  api.use('/absences', absencesRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/announcements', announcementsRouter);
  api.use('/tasks', tasksRouter);
  api.use('/task-templates', taskTemplatesRouter);
  api.use('/handover', handoverRouter);

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
