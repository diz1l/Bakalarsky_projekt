import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError, forbidden } from '../lib/http.js';
import { hasPermission, type Role } from '../lib/permissions.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const GUEST_USER: AuthUser = { id: 'usr-guest', name: 'Guest User', email: 'guest@hotel.com', role: 'GUEST' };

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'Unauthorized'));
  try {
    const { id, name, email, role } = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = { id, name, email, role };
    next();
  } catch {
    next(new HttpError(401, 'Unauthorized'));
  }
}

export const requirePermission = (permission: string) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !hasPermission(req.user.role, permission)) return next(forbidden());
  next();
};

export const can = (req: Request, permission: string) => !!req.user && hasPermission(req.user.role, permission);
