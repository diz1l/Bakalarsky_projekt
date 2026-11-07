import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { AppLayout } from '@/components/layout/AppLayout/AppLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { EmployeesPage } from '@/features/employees/pages/EmployeesPage';
import { ShiftsPage } from '@/features/shifts/pages/ShiftsPage';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import { AnnouncementsPage } from '@/features/announcements/pages/AnnouncementsPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { TasksPage } from '@/features/tasks/pages/TasksPage';
import { HandoverPage } from '@/features/handover/pages/HandoverPage';

function App() {
  return (
    <Provider store={store}>
      <ToastProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route
                  path="/dashboard"
                  element={
                    <RoleGuard permissions={['dashboard.view']}>
                      <DashboardPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/employees"
                  element={
                    <RoleGuard permissions={['employees.view']}>
                      <EmployeesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/shifts"
                  element={
                    <RoleGuard permissions={['shifts.view']}>
                      <ShiftsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <RoleGuard permissions={['tasks.view']}>
                      <TasksPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/handover"
                  element={
                    <RoleGuard permissions={['handover.view']}>
                      <HandoverPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <RoleGuard permissions={['notifications.view']}>
                      <NotificationsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/announcements"
                  element={
                    <RoleGuard permissions={['announcements.view']}>
                      <AnnouncementsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RoleGuard permissions={['profile.view']}>
                      <ProfilePage />
                    </RoleGuard>
                  }
                />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </Provider>
  );
}

export default App;
