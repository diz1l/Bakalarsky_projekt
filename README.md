# Staff Manager Frontend

Frontend app for staff operations management. The current version runs in mock mode (no backend required).

## Features
- Auth with roles: `ADMIN`, `MANAGER`, `EMPLOYEE`, plus `GUEST` login.
- Guest mode with read-only access to dashboard and core views.
- Forgot/Reset password as UI wrapper flow (mock only).
- Dashboard with quick insights (employees, shifts, notifications, announcements).
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
- `manager@hotel.com / password123`
- `employee@hotel.com / password123`
- Guest: click `Continue as Guest` on `/login`

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
- Employee records without a linked app account (`userId`) cannot receive personal notifications. Creating accounts and sending email, SMS, browser push, or real-time server events are not implemented.

## Backend (Back)
There is no production backend in this repository. The notification workflows above run through MSW and local mock persistence only. A production backend must implement authenticated, user-scoped notification endpoints (`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, and `DELETE /notifications`) and create the same events when employee, shift, and announcement records change. Email/SMS/push delivery also requires a provider and server-side configuration.

## Backend Integration Points
1. `src/app/baseApi.ts` - base URL, headers, and shared API config.
2. `src/features/*/api/*.ts` - RTK Query endpoints per feature.
3. `src/mocks/handlers/*` - disable/remove as real APIs become available.
4. `src/mocks/data/*` - remove mock persistence after backend rollout.
