import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useGetEmployeesQuery } from '@/features/employees/api/employeesApi';
import { useGetShiftsQuery } from '@/features/shifts/api/shiftsApi';
import { useGetNotificationsQuery } from '@/features/notifications/api/notificationsApi';
import { useGetAnnouncementsQuery } from '@/features/announcements/api/announcementsApi';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { formatTime, getWeekDates, toDateString } from '@/utils/dateUtils';
import s from './DashboardPage.module.scss';

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function getUpcomingWindowEnd(from: Date, days: number) {
  const end = new Date(from);
  end.setDate(from.getDate() + days);
  return end;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { can } = usePermissions();

  const now = new Date();
  const today = toDateString(now);
  const next7Days = toDateString(getUpcomingWindowEnd(now, 7));

  const thisWeekStart = toDateString(getWeekDates(now)[0]);
  const nextWeekBase = new Date(now);
  nextWeekBase.setDate(nextWeekBase.getDate() + 7);
  const nextWeekStart = toDateString(getWeekDates(nextWeekBase)[0]);

  const { data: employees = [] } = useGetEmployeesQuery();
  const { data: weekShifts = [] } = useGetShiftsQuery({ weekStart: thisWeekStart });
  const { data: nextWeekShifts = [] } = useGetShiftsQuery({ weekStart: nextWeekStart });
  const { data: notifications = [] } = useGetNotificationsQuery(user?.id ?? '');
  const { data: announcements = [] } = useGetAnnouncementsQuery();

  const mergedShifts = useMemo(() => {
    const map = new Map<string, (typeof weekShifts)[number]>();
    [...weekShifts, ...nextWeekShifts].forEach((shift) => {
      map.set(shift.id, shift);
    });
    return [...map.values()];
  }, [weekShifts, nextWeekShifts]);

  const upcomingShifts = useMemo(
    () =>
      mergedShifts
        .filter((shift) => shift.date >= today && shift.date <= next7Days)
        .sort((left, right) => {
          const byDate = left.date.localeCompare(right.date);
          return byDate !== 0 ? byDate : left.startTime.localeCompare(right.startTime);
        }),
    [mergedShifts, next7Days, today],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'active'),
    [employees],
  );

  const employeesByDepartment = useMemo(() => {
    const counts = new Map<string, number>();
    activeEmployees.forEach((employee) => {
      counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((left, right) => right.count - left.count);
  }, [activeEmployees]);

  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const activeAnnouncements = announcements.filter((item) => !item.completed).length;

  const lowStaffDays = useMemo(() => {
    const dayCounts = new Map<string, number>();
    upcomingShifts.forEach((shift) => {
      dayCounts.set(shift.date, (dayCounts.get(shift.date) ?? 0) + 1);
    });

    return [...dayCounts.entries()]
      .filter(([, count]) => count < 2)
      .map(([date]) => date);
  }, [upcomingShifts]);

  const overlapCount = useMemo(() => {
    let conflicts = 0;

    const groups = new Map<string, typeof upcomingShifts>();
    for (const shift of upcomingShifts) {
      const key = `${shift.employeeId}-${shift.date}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(shift);
      groups.set(key, bucket);
    }

    for (const shifts of groups.values()) {
      const sorted = [...shifts].sort((left, right) => left.startTime.localeCompare(right.startTime));
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index].startTime < sorted[index - 1].endTime) {
          conflicts += 1;
        }
      }
    }

    return conflicts;
  }, [upcomingShifts]);

  const warningNotifications = notifications.filter(
    (item) => item.type === 'warning' && !item.read,
  ).length;

  const alerts = [
    overlapCount > 0 ? `${overlapCount} shift overlap issue(s) found in the next 7 days.` : null,
    lowStaffDays.length > 0
      ? `${lowStaffDays.length} day(s) have low staffing (${lowStaffDays
          .slice(0, 2)
          .map((date) => dateLabel(date))
          .join(', ')}).`
      : null,
    warningNotifications > 0 ? `${warningNotifications} warning notification(s) need attention.` : null,
  ].filter(Boolean) as string[];

  return (
    <div className={s.page}>
      <h1 className={s.title}>Welcome back, {user?.name}</h1>

      <div className={s.grid}>
        <div className={s.card}>
          <span className={s.cardLabel}>Active Employees</span>
          <span className={s.cardValue}>{can('employees.view') ? activeEmployees.length : '-'}</span>
        </div>
        <div className={s.card}>
          <span className={s.cardLabel}>Upcoming Shifts (7 days)</span>
          <span className={s.cardValue}>{upcomingShifts.length}</span>
        </div>
        <div className={s.card}>
          <span className={s.cardLabel}>Unread Notifications</span>
          <span className={s.cardValue}>{unreadNotifications}</span>
        </div>
        <div className={s.card}>
          <span className={s.cardLabel}>Active Announcements</span>
          <span className={s.cardValue}>{activeAnnouncements}</span>
        </div>
      </div>

      <div className={s.split}>
        <section className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>Upcoming Shifts</h2>
            <Link to="/shifts" className={s.sectionLink}>
              Open shifts
            </Link>
          </div>
          {!upcomingShifts.length ? (
            <p className={s.emptyText}>No upcoming shifts in the next 7 days.</p>
          ) : (
            <div className={s.shiftList}>
              {upcomingShifts.slice(0, 8).map((shift) => (
                <div key={shift.id} className={s.shiftCard}>
                  <strong>{shift.employeeName}</strong>
                  <span>
                    {dateLabel(shift.date)} | {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                  </span>
                  <span className={s.dept}>{shift.department}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>Notifications Summary</h2>
            <Link to="/notifications" className={s.sectionLink}>
              Open notifications
            </Link>
          </div>
          {!notifications.length ? (
            <p className={s.emptyText}>No notifications yet.</p>
          ) : (
            <div className={s.notificationSummary}>
              {notifications.slice(0, 4).map((item) => (
                <div key={item.id} className={s.notificationItem}>
                  <span className={s.notificationTitle}>{item.title}</span>
                  <span className={s.notificationMeta}>{item.senderName}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={s.split}>
        <section className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>Employees by Department</h2>
            {can('employees.view') && (
              <Link to="/employees" className={s.sectionLink}>
                Open employees
              </Link>
            )}
          </div>
          {!can('employees.view') ? (
            <p className={s.emptyText}>Hidden for your role.</p>
          ) : employeesByDepartment.length === 0 ? (
            <p className={s.emptyText}>No active employee data.</p>
          ) : (
            <ul className={s.deptList}>
              {employeesByDepartment.map((entry) => (
                <li key={entry.department} className={s.deptItem}>
                  <span>{entry.department}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>Alerts</h2>
            <Link to="/announcements" className={s.sectionLink}>
              Open announcements
            </Link>
          </div>
          {!alerts.length ? (
            <p className={s.emptyText}>No critical alerts right now.</p>
          ) : (
            <ul className={s.alertList}>
              {alerts.map((alert) => (
                <li key={alert} className={s.alertItem}>
                  {alert}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
