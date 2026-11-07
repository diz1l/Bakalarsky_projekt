import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const notFound = () => new HttpError(404, 'Not found');
export const badRequest = (message: string) => new HttpError(400, message);

// Express recognises error handlers by their four parameters, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      errors: Object.fromEntries(error.issues.map((issue) => [issue.path.join('.'), issue.message])),
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
}

export const idParam = (req: Request) => String(req.params.id);
