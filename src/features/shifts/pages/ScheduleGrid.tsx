import type { Absence, Employee, Shift } from '@/types';
import { toDateString } from '@/utils/dateUtils';
import { useLocale } from '@/app/locale';
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
  onEdit: (shift: Shift) => void;
  onPickStatus: (employee: Employee, date: string) => void;
  onDeleteShift: (id: string) => void;
  onClearAbsence: (employeeId: string, date: string) => void;
  onRemoveEmployee: (id: string) => void;
}

export function ScheduleGrid({ employees, dates, shifts, absences, canCreate, canEdit, canDelete, canManageRoster, onEdit, onPickStatus, onDeleteShift, onClearAbsence, onRemoveEmployee }: ScheduleGridProps) {
  const { locale, t } = useLocale();
  const today = toDateString(new Date());
  return <div className={s.scheduleCard}>
    <div className={s.tableScroll}>
      <table className={s.schedule}>
        <thead><tr><th className={s.employeeHead}>{t('Employee')}</th>{dates.map((date) => { const dateString = toDateString(date); return <th key={dateString} className={dateString === today ? s.todayHead : ''}><span>{date.toLocaleDateString(locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' })}</span><b>{date.getDate()}</b></th>; })}</tr></thead>
        <tbody>{employees.map((employee) => <tr key={employee.id}>
          <th className={s.employeeName}><span>{employee.firstName} {employee.lastName}</span><small>{employee.department}</small>{canManageRoster && <button className={s.removeEmployee} onClick={() => onRemoveEmployee(employee.id)} aria-label={`${t('Remove')} ${employee.firstName} ${employee.lastName}`}>×</button>}</th>
          {dates.map((date) => {
            const dateString = toDateString(date);
            const shift = shifts.find((item) => item.employeeId === employee.id && item.date === dateString);
            const absence = absences.find((item) => item.employeeId === employee.id && item.date === dateString);
            return <ShiftCell key={dateString} shift={shift} absence={absence} date={dateString} today={dateString === today} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onPickStatus={() => onPickStatus(employee, dateString)} onDeleteShift={onDeleteShift} onClearAbsence={() => onClearAbsence(employee.id, dateString)} />;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <div className={s.legend}><span><i className={s.codeD}>D</i> {t('Day shift')}</span><span><i className={s.codeN}>N</i> {t('Night shift')}</span><span><i className={s.codeH}>H</i> {t('Paid leave')}</span><span><i className={s.codeS}>S</i> {t('Sick')}</span><span><i className={s.codeX}>×</i> {t('Unavailable')}</span><span className={s.hint}>{t('Right-click to clear an absence')}</span></div>
  </div>;
}
