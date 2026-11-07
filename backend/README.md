# Staff Manager API

Express 5 + TypeScript API using Prisma, SQLite for local development, and JWT authentication. The API contract and domain rules are in [BACKEND_SPEC.md](../docs/BACKEND_SPEC.md).

## Local setup

```bash
cd backend
cp .env.example .env
npm ci
npx prisma migrate dev
npm run db:seed                 # admin demo login: admin@hotel.com / password123
npm run dev                     # http://localhost:3000/api
```

Set `VITE_USE_MOCKS=false` in the frontend environment to use the API. The reset-password endpoint sends one-time links through SMTP. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, and `APP_URL`. In development without SMTP, the reset link is printed to the API console; production requires SMTP.

The API stores only a SHA-256 hash of each reset token. Tokens expire after 30 minutes, are single use, and are invalidated when another reset is requested or a password is changed. The seeded manager and employee accounts must change their temporary password at first sign-in; admins can issue one-time credentials from the Access accounts screen.

## Scheduled work

`node-cron` runs maintenance every five minutes in `SCHEDULER_TIMEZONE` (defaults to `Europe/Prague`): it materializes current/next shift template tasks, carries unfinished one-off tasks forward, moves overdue handovers, reminds assignees about unfinished past-shift tasks, and escalates overdue critical handovers to managers. GET endpoints retain their idempotent catch-up logic for deployments that start after downtime.

## API tests

```bash
npm test
```

The Supertest suite runs in Node with its own Vitest config, separate from the frontend's MSW/JSDOM setup.

## Docker Compose

At the project root, create `.env` with a strong `JWT_SECRET`, then start the frontend and API:

```bash
printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" > .env
docker compose up --build -d
```

Open `http://localhost:8080`. The API applies migrations on startup and keeps its SQLite database in the `staff-manager-data` volume. To create demo accounts in a new deployment, run `docker compose exec backend npm run db:seed`; replace the demo credentials before exposing the app publicly. Configure the SMTP variables in the root `.env` for password reset emails.
