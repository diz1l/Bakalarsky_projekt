import type { Absence, Employee, Shift } from '@/types';
import { toDateString } from '@/utils/dateUtils';
import { useLocale } from '@/app/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import s from './ShiftsPage.module.scss';
import { ShiftCell } from './ShiftCell';

interface ScheduleGridProps {
  employees: Employee[];
  dates: Date[];
  shifts: Shift[];
  absences: Absence[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageRoster: boolean;
  requestEmployeeId?: string;
  onEdit: (shift: Shift) => void;
  onPickStatus: (employee: Employee, date: string) => void;
  onDeleteShift: (id: string) => void;
  onClearAbsence: (employeeId: string, date: string) => void;
  onRemoveEmployee: (id: string) => void;
}

export function ScheduleGrid({ employees, dates, shifts, absences, canCreate, canEdit, canDelete, canManageRoster, requestEmployeeId, onEdit, onPickStatus, onDeleteShift, onClearAbsence, onRemoveEmployee }: ScheduleGridProps) {
  const { locale, t } = useLocale();
  const today = toDateString(new Date());
  const [mobileSelectedDate, setMobileSelectedDate] = useState(today);
  const mobileDateIndex = Math.max(0, dates.findIndex((date) => toDateString(date) === mobileSelectedDate));
  const mobileDate = dates[mobileDateIndex] ?? dates[0];
  const mobileDateString = toDateString(mobileDate);
  const formatDay = (date: Date) => date.toLocaleDateString(locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const renderCell = (employee: Employee, dateString: string, isToday: boolean) => {
    const shift = shifts.find((item) => item.employeeId === employee.id && item.date === dateString);
    const absence = absences.find((item) => item.employeeId === employee.id && item.date === dateString);
    return <ShiftCell shift={shift} absence={absence} date={dateString} today={isToday} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} canRequest={employee.id === requestEmployeeId} onEdit={onEdit} onPickStatus={() => onPickStatus(employee, dateString)} onDeleteShift={onDeleteShift} onClearAbsence={() => onClearAbsence(employee.id, dateString)} />;
  };
  return <div className={s.scheduleCard}>
    <div className={s.mobileSchedule}>
      <div className={s.mobileDateNav}>
        <Button variant="secondary" size="sm" aria-label={t('Previous day')} disabled={mobileDateIndex <= 0} onClick={() => setMobileSelectedDate(toDateString(dates[Math.max(0, mobileDateIndex - 1)]))}>‹</Button>
        <label><span>{t('All colleagues · day view')}</span><select value={mobileDateString} onChange={(event) => setMobileSelectedDate(event.target.value)}>{dates.map((date) => <option key={toDateString(date)} value={toDateString(date)}>{formatDay(date)}</option>)}</select></label>
        <Button variant="secondary" size="sm" aria-label={t('Next day')} disabled={mobileDateIndex >= dates.length - 1} onClick={() => setMobileSelectedDate(toDateString(dates[Math.min(dates.length - 1, mobileDateIndex + 1)]))}>›</Button>
      </div>
      <div className={s.mobilePeople}>
        {employees.map((employee) => {
          const shift = shifts.find((item) => item.employeeId === employee.id && item.date === mobileDateString);
          const time = shift?.startTime && shift?.endTime ? `${shift.startTime}–${shift.endTime}` : '';
          return <article className={s.mobilePerson} key={employee.id}>
            <div className={s.mobilePersonInfo}><strong>{employee.firstName} {employee.lastName}</strong><span>{t(employee.department)}</span></div>
            <div className={s.mobilePersonShift}>{renderCell(employee, mobileDateString, mobileDateString === today)}{time && <small>{time}</small>}</div>
          </article>;
        })}
      </div>
    </div>
    <div className={s.tableScroll}>
      <table className={s.schedule}>
        <thead><tr><th className={s.employeeHead}>{t('Employee')}</th>{dates.map((date) => { const dateString = toDateString(date); return <th key={dateString} className={dateString === today ? s.todayHead : ''}><span>{date.toLocaleDateString(locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' })}</span><b>{date.getDate()}</b></th>; })}</tr></thead>
        <tbody>{employees.map((employee) => <tr key={employee.id}>
          <th className={s.employeeName}><span>{employee.firstName} {employee.lastName}</span><small>{employee.department}</small>{canManageRoster && <button className={s.removeEmployee} onClick={() => onRemoveEmployee(employee.id)} aria-label={`${t('Remove')} ${employee.firstName} ${employee.lastName}`}>×</button>}</th>
          {dates.map((date) => {
            const dateString = toDateString(date);
            return <td key={dateString} className={dateString === today ? s.todayCell : ''}>{renderCell(employee, dateString, dateString === today)}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <div className={s.legend}><span><i className={s.codeD}>D</i> {t('Day shift')}</span><span><i className={s.codeN}>N</i> {t('Night shift')}</span><span><i className={s.codeH}>H</i> {t('Paid leave')}</span><span><i className={s.codeS}>S</i> {t('Sick')}</span><span><i className={s.codeX}>×</i> {t('Unavailable')}</span><span className={s.hint}>{t(canManageRoster ? 'Tap a marked day to clear an absence' : 'Use + on your row to request time off')}</span></div>
  </div>;
}
