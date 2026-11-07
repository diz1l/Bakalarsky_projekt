export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: '12h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  shiftHours: { DAY: { start: '07:00', end: '19:00' }, NIGHT: { start: '19:00', end: '07:00' } },
} as const;
