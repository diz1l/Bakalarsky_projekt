# Staff Manager Frontend

Frontend app for staff operations management. The current version runs in mock mode (no backend required).

## Features
- Auth with roles: `ADMIN`, `MANAGER`, `EMPLOYEE`, plus `GUEST` login.
- Guest mode with read-only access to dashboard and core views.
- Forgot/Reset password as UI wrapper flow (mock only).
- Dashboard with quick insights (employees, shifts, notifications, announcements).
- Notifications with details modal, `Mark all as read`, and `Clear all`.
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

## Backend Integration Points
1. `src/app/baseApi.ts` - base URL, headers, and shared API config.
2. `src/features/*/api/*.ts` - RTK Query endpoints per feature.
3. `src/mocks/handlers/*` - disable/remove as real APIs become available.
4. `src/mocks/data/*` - remove mock persistence after backend rollout.
