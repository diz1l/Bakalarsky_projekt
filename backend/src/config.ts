export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: '12h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM ?? 'Staff Manager <noreply@localhost>',
  },
  shiftHours: { DAY: { start: '07:00', end: '19:00' }, NIGHT: { start: '19:00', end: '07:00' } },
} as const;
