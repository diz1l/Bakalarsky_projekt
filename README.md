# Staff Manager Frontend

Hotel staff operations app with an optional Express/Prisma backend. The frontend defaults to MSW mock mode for local UI work.

## Features
- Auth with roles: `ADMIN`, `MANAGER`, `EMPLOYEE`, plus `GUEST` login.
- Guest mode with read-only access to dashboard and core views.
- Forgot/Reset password as UI wrapper flow (mock only).
- Dashboard with quick insights (employees, shifts, notifications, announcements).
- Monthly employee shift matrix with day/night types and API-backed leave, sick, and unavailable marks.
- Persistent, chaptered shift checklists with per-shift progress, bulk check/uncheck, and manager/admin-only template editing.
- Next-shift handover with acknowledgement tracking.
- English, Czech, and Russian interface options; responsive navigation and light/dark themes.
- Role-aware notifications for shifts, employees, schedule conflicts, and announcements.
- Notifications with an unread counter, details modal, `Mark all as read`, and `Clear all`.
- Announcements with filters, completion state, and delete action.
- Profile forms for updating session info and password (mock behavior).
- Attendance removed from routes/navigation.

## Tech Stack
- React 19 + TypeScript
- Redux Toolkit + RTK Query
- React Router
- React Hook Form + Zod
- SCSS Modules
- MSW (API mocking)
- Vitest + React Testing Library

## Project Preview
### Login
![Login](src/assets/img/login.png)

### Dashboard
![Dashboard](src/assets/img/Dashboard.png)

### Employees
![Employees](src/assets/img/Employees.png)

### Shifts
![Shifts](src/assets/img/Shifts.png)

### Notifications
![Notifications](src/assets/img/Notifications.png)

### Announcements
![Announcements](src/assets/img/Announcements.png)

### Profile
![Profile](src/assets/img/Profile.png)

## Run
```bash
npm install
npm run dev
```

## Validation
```bash
npx tsc -b
npm run lint
npm test
```

## Demo Access
- `admin@hotel.com / password123`
- Managers and employees must receive credentials from an administrator and change their temporary password at first sign-in.
- Guest: click `Continue as Guest` on `/login`

### Staff account provisioning
- Sign in as the admin and open **Access accounts**.
- Select an active employee without an account and issue a login. Give the one-time temporary password to them securely.
- They sign in with their work email and issued password, then must set their own password before using the app.
- Admins can issue a new temporary password if an employee forgets it. Existing temporary passwords are never displayed again.
- In mock mode, accounts and passwords are stored in browser local storage. Use the backend for real credential storage; temporary passwords are returned once and are not emailed.

## Mock Mode
- API calls are intercepted by MSW handlers in `src/mocks/handlers/*`.
- Session keys in `localStorage`:
  - `access_token`
  - `auth_user`
- Mock persistence key:
  - `staff_manager_mock_state_v1`

### Notification behavior
- Employees receive notifications only for shifts assigned to their linked account, shift changes/cancellations, and new announcements.
- Admins and managers receive notifications about employee record changes and overlapping shifts (except for the manager who performed the action). Announcements are delivered to all other employee, admin, and manager accounts.
- Opening an unread notification marks it as read. Users can mark all as read or clear only their own notifications; guest mode remains read-only.
- New notifications are kept in the mock persistence store, ordered newest-first, and the sidebar unread counter refreshes periodically while the app is open.
- Employee records without a linked app account (`userId`) cannot receive personal notifications. SMS, browser push, and real-time server events are not implemented.

## Backend

The Express + Prisma API in `backend/` implements authentication, employees, shifts, absences, notifications, announcements, tasks, and handovers. Password reset links use one-time hashed tokens and SMTP. A five-minute scheduler handles task carry-over, handover forwarding, overdue-task reminders, and critical handover escalation.

Run the frontend and API separately using [backend/README.md](backend/README.md), or start the Docker Compose setup from the project root. For API mode set `VITE_USE_MOCKS=false`; set `VITE_API_URL` if the API is not served through the Compose `/api` proxy.

## Backend Integration Points
1. `src/app/baseApi.ts` - base URL, auth headers, and shared RTK Query config.
2. `src/features/*/api/*.ts` - RTK Query endpoints per feature.
3. `src/mocks/handlers/*` - mock implementation selected by `VITE_USE_MOCKS`.
4. `backend/src/routes/*` - API routes.

## Cloudflare Pages preparation

The React/Vite frontend is ready to build as a Cloudflare Pages site:

- Root directory: `/`
- Build command: `npm run build` — exactly this. Typing `tsc -b && vite build` directly fails with `tsc: not found`, because only npm scripts put `node_modules/.bin` on the `PATH`.
- Build output directory: `dist`
- Without `VITE_API_URL` the build runs as a **demo on mock data** (MSW in the browser, data kept in the visitor's `localStorage`). To use a deployed backend, set `VITE_API_URL` to the public API origin ending in `/api` (see `.env.production.example`); `VITE_USE_MOCKS=true/false` forces either mode.

These settings match Cloudflare's [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/). The build has no top-level `404.html`, so Pages' [SPA fallback](https://developers.cloudflare.com/pages/configuration/serving-pages/) serves client-side routes such as `/profile` on direct loads. Do not add a catch-all `_redirects` rule.

Pages only hosts the frontend in this setup. The Express/Prisma API must be deployed separately and reachable over HTTPS. Configure its `CORS_ORIGIN` and `APP_URL` to the Pages domain, use a production database with persistent storage, set a strong `JWT_SECRET`, configure SMTP, and replace the seeded admin credential before accepting real users. The checked-in SQLite configuration is for local development and the API has not been ported to Cloudflare Workers. 
