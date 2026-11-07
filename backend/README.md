# Staff Manager — backend

REST API for the Staff Manager frontend. Contract and business rules: [../docs/BACKEND_SPEC.md](../docs/BACKEND_SPEC.md).

Stack: Node.js + TypeScript, Express 5, Prisma (SQLite locally, PostgreSQL in production), Zod, JWT, bcrypt.

## Run locally

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates prisma/dev.db
npm run db:seed                      # demo accounts, password: password123
npm run dev                          # http://localhost:3000/api
```

Frontend: set `VITE_USE_MOCKS=false` in the frontend `.env.local` so requests reach this server instead of MSW.

## Structure

- `src/app.ts` — routers, CORS, error handler
- `src/middleware/auth.ts` — JWT (`requireAuth`), permissions (`requirePermission`)
- `src/lib/permissions.ts` — role matrix, same as the frontend
- `src/lib/shiftSlots.ts` — day/night shift slots in the hotel time zone
- `src/lib/notify.ts` — notification fan-out (never to the actor)
- `src/routes/*` — one router per resource

## Not done yet

- Password reset by e-mail (`/auth/forgot-password`, `/auth/reset-password`).
- Scheduled jobs: carry-over of tasks and forwarding of handover notes run lazily on GET requests;
  move them to a scheduler (`node-cron`) and add reminders/escalations from the spec.
- API tests (`vitest` + `supertest`).
