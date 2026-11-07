import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useGetEmployeesQuery, useGetScheduleRosterQuery } from '@/features/employees/api/employeesApi';
import { useGetShiftsQuery } from '@/features/shifts/api/shiftsApi';
import { useGetNotificationsQuery } from '@/features/notifications/api/notificationsApi';
import { useGetAnnouncementsQuery } from '@/features/announcements/api/announcementsApi';
import { useGetTasksQuery } from '@/features/tasks/api/tasksApi';
import { useGetHandoverNotesQuery } from '@/features/handover/api/handoverApi';
import { getCurrentSlot } from '@/utils/shiftUtils';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { formatTime, getWeekDates, toDateString } from '@/utils/dateUtils';
import s from './DashboardPage.module.scss';
import { useLocale } from '@/app/locale';

function dateLabel(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
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
  const { locale, t } = useLocale();

  const now = new Date();
  const today = toDateString(now);
  const next7Days = toDateString(getUpcomingWindowEnd(now, 7));

  const thisWeekStart = toDateString(getWeekDates(now)[0]);
  const nextWeekBase = new Date(now);
  nextWeekBase.setDate(nextWeekBase.getDate() + 7);
  const nextWeekStart = toDateString(getWeekDates(nextWeekBase)[0]);

  const canViewEmployees = can('employees.view');
  const { data: employees = [] } = useGetEmployeesQuery(undefined, { skip: !canViewEmployees });
  const { data: rosterEmployees = [] } = useGetScheduleRosterQuery(undefined, { skip: canViewEmployees });
  const { data: weekShifts = [] } = useGetShiftsQuery({ weekStart: thisWeekStart });
  const { data: nextWeekShifts = [] } = useGetShiftsQuery({ weekStart: nextWeekStart });
  const { data: notifications = [] } = useGetNotificationsQuery(user?.id ?? '');
  const { data: announcements = [] } = useGetAnnouncementsQuery();
  const currentSlot = getCurrentSlot(now);
  const { data: currentTasks = [] } = useGetTasksQuery({ date: currentSlot.date, shiftType: currentSlot.type });
  const { data: handovers = [] } = useGetHandoverNotesQuery('active');

  const mergedShifts = useMemo(() => {
    const map = new Map<string, (typeof weekShifts)[number]>();
    [...weekShifts, ...nextWeekShifts].forEach((shift) => {
      map.set(shift.id, shift);
    });
    return [...map.values()];
  }, [weekShifts, nextWeekShifts]);

  const upcomingShifts = mergedShifts
    .filter((shift) => shift.date >= today && shift.date <= next7Days)
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      return byDate !== 0 ? byDate : left.startTime.localeCompare(right.startTime);
    });

  const activeEmployees = useMemo(
    () => (canViewEmployees ? employees : rosterEmployees).filter((employee) => employee.status === 'active'),
    [canViewEmployees, employees, rosterEmployees],
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
  const openCurrentTasks = currentTasks.filter((task) => task.status === 'open').length;
  const pendingHandovers = handovers.filter((note) => !note.acknowledgements.some((ack) => ack.userId === user?.id && (note.requiresAction ? ack.actionTakenAt : ack.readAt)));
  const criticalHandovers = pendingHandovers.filter((note) => note.priority === 'critical').length;

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
    overlapCount > 0 ? t('shift overlap warning').replace('{count}', String(overlapCount)) : null,
    lowStaffDays.length > 0
      ? t('low staffing warning').replace('{count}', String(lowStaffDays.length)).replace('{days}', lowStaffDays
          .slice(0, 2)
          .map((date) => dateLabel(date, locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US'))
          .join(', '))
      : null,
    warningNotifications > 0 ? t('warning notifications').replace('{count}', String(warningNotifications)) : null,
  ].filter(Boolean) as string[];

  return (
    <div className={s.page}>
      <h1 className={s.title}>{t('Welcome back')}, {user?.name}</h1>

      <div className={s.grid}>
        <div className={s.card}>
          <span className={s.cardLabel}>{t('Active Employees')}</span>
          <span className={s.cardValue}>{activeEmployees.length}</span>
        </div>
        <div className={s.card}>
          <span className={s.cardLabel}>{t('Upcoming Shifts (7 days)')}</span>
          <span className={s.cardValue}>{upcomingShifts.length}</span>
        </div>
        <div className={s.card}>
          <span className={s.cardLabel}>{t('Unread Notifications')}</span>
          <span className={s.cardValue}>{unreadNotifications}</span>
        </div>
        <div className={s.card}>
          <span className={s.cardLabel}>{t('Active Announcements')}</span>
          <span className={s.cardValue}>{activeAnnouncements}</span>
        </div>
        {can('tasks.view') && <Link to="/tasks" className={s.card}><span className={s.cardLabel}>{t('Open tasks in current shift')}</span><span className={s.cardValue}>{openCurrentTasks}</span></Link>}
        {can('handover.view') && <Link to="/handover" className={s.card}><span className={s.cardLabel}>{t('Handover awaiting acknowledgement')}</span><span className={s.cardValue}>{pendingHandovers.length}<small className={s.cardDetail}>{criticalHandovers} {t('critical')}</small></span></Link>}
      </div>

      <div className={s.split}>
        <section className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{t('Upcoming Shifts')}</h2>
            <Link to="/shifts" className={s.sectionLink}>
              {t('Open shifts')}
            </Link>
          </div>
          {!upcomingShifts.length ? (
            <p className={s.emptyText}>{t('No upcoming shifts in the next 7 days.')}</p>
          ) : (
            <div className={s.shiftList}>
              {upcomingShifts.slice(0, 8).map((shift) => (
                <div key={shift.id} className={s.shiftCard}>
                  <strong>{shift.employeeName}</strong>
                  <span>
                    {dateLabel(shift.date, locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US')} | {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                  </span>
                  <span className={s.dept}>{shift.department}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={s.section}>
          <div className={s.sectionHeader}>
            <h2 className={s.sectionTitle}>{t('Notifications Summary')}</h2>
            <Link to="/notifications" className={s.sectionLink}>
              {t('Open notifications')}
            </Link>
          </div>
          {!notifications.length ? (
            <p className={s.emptyText}>{t('No notifications yet.')}</p>
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
            <h2 className={s.sectionTitle}>{t('Employees by Department')}</h2>
            {can('employees.view') && (
              <Link to="/employees" className={s.sectionLink}>
                {t('Open employees')}
              </Link>
            )}
          </div>
          {employeesByDepartment.length === 0 ? (
            <p className={s.emptyText}>{t('No active employee data.')}</p>
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
            <h2 className={s.sectionTitle}>{t('Alerts')}</h2>
            <Link to="/announcements" className={s.sectionLink}>
              {t('Open announcements')}
            </Link>
          </div>
          {!alerts.length ? (
            <p className={s.emptyText}>{t('No critical alerts right now.')}</p>
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
