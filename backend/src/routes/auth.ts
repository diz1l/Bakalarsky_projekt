import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError, badRequest } from '../lib/http.js';
import { GUEST_USER, requireAuth, requirePermission, signToken, type AuthUser } from '../middleware/auth.js';
import type { Role } from '../lib/permissions.js';

export const authRouter = Router();

const toUser = (user: { id: string; login: string; email: string; name: string; role: string }) => ({
  id: user.id, login: user.login, email: user.email, name: user.name, role: user.role as Role,
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Invalid credentials');
  const session: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role as Role };
  res.json({ token: signToken(session), user: toUser(user) });
});

authRouter.post('/guest', (_req, res) => {
  res.json({ token: signToken(GUEST_USER), user: { ...GUEST_USER, login: 'guest' } });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  if (req.user!.role === 'GUEST') return void res.json({ ...GUEST_USER, login: 'guest' });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new HttpError(401, 'Unauthorized');
  res.json(toUser(user));
});

// TODO: send the reset link by e-mail and store a hashed, expiring token instead of returning it.
authRouter.post('/forgot-password', async (req, res) => {
  z.object({ email: z.string().email() }).parse(req.body);
  res.json({ message: 'If this email exists, we sent a reset link', token: '' });
});

authRouter.post('/reset-password', (_req, res) => {
  res.status(501).json({ message: 'Password reset by e-mail is not configured yet' });
});

authRouter.patch('/profile', requireAuth, requirePermission('profile.edit'), async (req, res) => {
  const data = z.object({ name: z.string().min(1), login: z.string().min(3), email: z.string().email() }).parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json(toUser(user));
});

authRouter.post('/change-password', requireAuth, requirePermission('profile.edit'), async (req, res) => {
  const { oldPassword, newPassword } = z.object({ oldPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(oldPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ message: 'Password updated' });
});
