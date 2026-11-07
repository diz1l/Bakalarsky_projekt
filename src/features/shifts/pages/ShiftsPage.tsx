import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGetShiftsQuery, useCreateShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation } from '../api/shiftsApi';
import { useGetEmployeesQuery } from '@/features/employees/api/employeesApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { toDateString, formatTime, hasTimeOverlap } from '@/utils/dateUtils';
import { Button } from '@/components/ui/Button/Button';
import { Modal } from '@/components/ui/Modal/Modal';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import type { Shift } from '@/types';
import s from './ShiftsPage.module.scss';
import { useLocale } from '@/app/locale';

const shiftSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  notes: z.string().optional(),
});
type ShiftFormData = z.infer<typeof shiftSchema>;

const DEPARTMENTS = [
  { value: 'Front Desk', label: 'Front Desk' },
  { value: 'Housekeeping', label: 'Housekeeping' },
  { value: 'Restaurant', label: 'Restaurant' },
  { value: 'Maintenance', label: 'Maintenance' },
];

export function ShiftsPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { locale, t } = useLocale();
  const [monthOffset, setMonthOffset] = useState(0);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset]);

  const monthDates = useMemo(() => Array.from({ length: new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate() }, (_, day) => new Date(baseDate.getFullYear(), baseDate.getMonth(), day + 1)), [baseDate]);
  const weekStart = toDateString(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  const endDate = toDateString(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));

  const { data: shifts = [] } = useGetShiftsQuery({ weekStart, endDate });
  const { data: employees = [] } = useGetEmployeesQuery();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [updateShift, { isLoading: updating }] = useUpdateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [dayCodes, setDayCodes] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('staff-shift-codes') || '{}'));
  const [roster, setRoster] = useState<string[] | null>(() => { const saved = localStorage.getItem('staff-shift-roster'); return saved ? JSON.parse(saved) as string[] : null; });
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [statusTarget, setStatusTarget] = useState<{ employeeId: string; date: string; key: string } | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [shiftType, setShiftType] = useState<'D' | 'N'>('D');
  const updateRoster = (next: string[]) => { setRoster(next); localStorage.setItem('staff-shift-roster', JSON.stringify(next)); };
  const activeEmployees = employees.filter((employee) => employee.status === 'active');
  const scheduledEmployeeIds = roster ?? activeEmployees.map((employee) => employee.id);
  const setCode = (key: string, code: string) => setDayCodes((previous) => {
    const next = { ...previous };
    if (code) next[key] = code; else delete next[key];
    localStorage.setItem('staff-shift-codes', JSON.stringify(next));
    return next;
  });

  const currentEmployee = employees.find((employee) => employee.userId === user?.id);

  const visibleShifts = can('shifts.viewAll')
    ? shifts
    : shifts.filter((sh) => sh.employeeId === currentEmployee?.id);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
  });

  const watchDate = watch('date');
  const watchEmpId = watch('employeeId');
  const watchStart = watch('startTime');
  const watchEnd = watch('endTime');

  const checkConflict = () => {
    if (!watchDate || !watchEmpId || !watchStart || !watchEnd) return;
    const found = shifts.find(
      (sh) =>
        sh.employeeId === watchEmpId &&
        sh.date === watchDate &&
        sh.id !== editing?.id &&
        hasTimeOverlap(watchStart, watchEnd, sh.startTime, sh.endTime),
    );
    setConflict(found ? `Overlaps with ${found.employeeName} shift ${formatTime(found.startTime)}–${formatTime(found.endTime)}` : null);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setAssignedEmployeeId(shift.employeeId);
    setShiftType(Number(shift.startTime.slice(0, 2)) >= 18 || Number(shift.startTime.slice(0, 2)) < 6 ? 'N' : 'D');
    setConflict(null);
    reset({ employeeId: shift.employeeId, date: shift.date, startTime: shift.startTime, endTime: shift.endTime, department: shift.department, notes: shift.notes || '' });
    setModalOpen(true);
  };

  const chooseStatus = (code: 'D' | 'N' | 'H' | 'S' | '×') => {
    if (!statusTarget) return;
    if (code !== 'D' && code !== 'N') setCode(statusTarget.key, code);
    setStatusModalOpen(false);
    if (code === 'D' || code === 'N') {
      const employee = employees.find((item) => item.id === statusTarget.employeeId);
      if (!employee) return;
      setAssignedEmployeeId(employee.id);
      setEditing(null);
      setShiftType(code);
      setConflict(null);
      reset({ employeeId: employee.id, date: statusTarget.date, startTime: '', endTime: '', department: 'Front Desk', notes: '' });
      setModalOpen(true);
    }
  };

  const onSubmit = async (data: ShiftFormData) => {
    const emp = employees.find((e) => e.id === data.employeeId);
    const body = { ...data, startTime: data.startTime || '', endTime: data.endTime || '', employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown', status: 'scheduled' as const };
    try {
      if (editing) {
        await updateShift({ ...editing, ...body }).unwrap();
        showToast('Shift updated', 'success');
      } else {
        await createShift(body).unwrap();
        showToast('Shift created', 'success');
      }
      setCode(`${data.employeeId}:${data.date}`, shiftType);
      setModalOpen(false);
    } catch {
      showToast('Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shift?')) return;
    try {
      await deleteShift(id).unwrap();
      showToast('Shift deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  return (
    <div>
      <div className={s.toolbar}>
        <div><h1>{t('Shift schedule')}</h1><p className={s.subtitle}>Michelangelo Hotel · {baseDate.toLocaleDateString(locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' })}</p></div>
        <div className={s.weekNav}>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset((o) => o - 1)}>← {t('Prev')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setMonthOffset(0)}>{t('This month')}</Button>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset((o) => o + 1)}>{t('Next')} →</Button>
        </div>
      </div>

      <div className={s.rosterTools}>{can('shifts.viewAll') && <><span>{activeEmployees.filter((employee) => scheduledEmployeeIds.includes(employee.id)).length} {t('people on schedule')}</span><Button variant="secondary" size="sm" onClick={() => setShowAddEmployee(true)}>+ {t('Add employee')}</Button></>}</div>
      <div className={s.scheduleCard}><div className={s.tableScroll}><table className={s.schedule}><thead><tr><th className={s.employeeHead}>Employee</th>{monthDates.map((date) => <th key={date.toISOString()} className={toDateString(date) === toDateString(new Date()) ? s.todayHead : ''}><span>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span><b>{date.getDate()}</b></th>)}</tr></thead><tbody>{employees.filter((employee) => employee.status === 'active' && (can('shifts.viewAll') ? scheduledEmployeeIds.includes(employee.id) : employee.id === currentEmployee?.id)).map((employee) => <tr key={employee.id}><th className={s.employeeName}><span>{employee.firstName} {employee.lastName}</span><small>{employee.department}</small>{can('shifts.viewAll') && <button className={s.removeEmployee} onClick={() => updateRoster(scheduledEmployeeIds.filter((id) => id !== employee.id))} aria-label={`Remove ${employee.firstName} from schedule`}>×</button>}</th>{monthDates.map((date) => {
        const dateStr = toDateString(date); const key = `${employee.id}:${dateStr}`; const shift = visibleShifts.find((item) => item.employeeId === employee.id && item.date === dateStr); const code = dayCodes[key] || (shift ? (Number(shift.startTime.slice(0, 2)) >= 18 || Number(shift.startTime.slice(0, 2)) < 6 ? 'N' : 'D') : '');
        return <td key={dateStr} className={`${code ? s[`code${code === '×' ? 'X' : code}`] : ''} ${dateStr === toDateString(new Date()) ? s.todayCell : ''}`}><button title={shift ? `${shift.startTime && shift.endTime ? `${formatTime(shift.startTime)}–${formatTime(shift.endTime)} · ` : ''}${shift.department}` : `${employee.firstName} · choose shift type`} onClick={() => { if (shift && can('shifts.edit')) openEdit(shift); else if (!shift && can('shifts.create')) { setStatusTarget({ employeeId: employee.id, date: dateStr, key }); setStatusModalOpen(true); } }} onContextMenu={(event) => { event.preventDefault(); if (shift && can('shifts.delete')) handleDelete(shift.id); else setCode(key, ''); }}>{code || (can('shifts.create') ? '+' : '—')}</button></td>;
      })}</tr>)}</tbody></table></div><div className={s.legend}><span><i className={s.codeD}>D</i> Day shift</span><span><i className={s.codeN}>N</i> Night shift</span><span><i className={s.codeH}>H</i> Paid leave</span><span><i className={s.codeS}>S</i> Sick</span><span><i className={s.codeX}>×</i> Unavailable</span><span className={s.hint}>Click an empty cell to cycle status · right click to clear/delete</span></div></div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('Edit Shift') : t('New Shift')}>
        <form onSubmit={handleSubmit(onSubmit)} onChange={checkConflict}>
          <input type="hidden" {...register('employeeId')} />
          <div className={s.assignedTo}>{t('Assigned to')} <strong>{employees.find((employee) => employee.id === assignedEmployeeId)?.firstName} {employees.find((employee) => employee.id === assignedEmployeeId)?.lastName}</strong></div>
          <div className={s.typePicker} aria-label="Shift type"><button type="button" className={shiftType === 'D' ? s.selectedType : ''} onClick={() => setShiftType('D')}><b>D</b><span>Day shift</span></button><button type="button" className={shiftType === 'N' ? s.selectedType : ''} onClick={() => setShiftType('N')}><b>N</b><span>Night shift</span></button></div>
          <FormField label={t('Date')} error={errors.date?.message} required>
            <Input type="date" {...register('date')} error={!!errors.date} />
          </FormField>
          <div className={s.timeRow}>
            <FormField label={t('Start (optional)')} error={errors.startTime?.message}>
              <Input type="time" {...register('startTime')} error={!!errors.startTime} />
            </FormField>
            <FormField label={t('End (optional)')} error={errors.endTime?.message}>
              <Input type="time" {...register('endTime')} error={!!errors.endTime} />
            </FormField>
          </div>
          <FormField label={t('Department')} error={errors.department?.message} required>
            <Select options={DEPARTMENTS.map((item) => ({ ...item, label: t(item.label) }))} {...register('department')} error={!!errors.department} />
          </FormField>
          <FormField label={t('Notes')}>
            <Input {...register('notes')} />
          </FormField>
          {conflict && <div className={s.conflict}>⚠ {conflict}</div>}
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={creating || updating}>{editing ? t('Save') : t('Create')}</Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Choose schedule entry">
        <div className={s.statusChoices}>
          <button className={s.codeD} onClick={() => chooseStatus('D')}><b>D</b><span>Day shift</span></button>
          <button className={s.codeN} onClick={() => chooseStatus('N')}><b>N</b><span>Night shift</span></button>
          <button className={s.codeH} onClick={() => chooseStatus('H')}><b>H</b><span>Paid leave</span></button>
          <button className={s.codeS} onClick={() => chooseStatus('S')}><b>S</b><span>Sick</span></button>
          <button className={s.codeX} onClick={() => chooseStatus('×')}><b>×</b><span>Unavailable</span></button>
        </div>
      </Modal>
      <Modal isOpen={showAddEmployee} onClose={() => setShowAddEmployee(false)} title={t('Add employee to schedule')}>
        <p className={s.addDescription}>{t("Choose an active employee to add as a new row in this hotel's roster.")}</p>
        <div className={s.employeePicker}>{employees.filter((employee) => employee.status === 'active' && !scheduledEmployeeIds.includes(employee.id)).map((employee) => <button key={employee.id} onClick={() => { updateRoster([...scheduledEmployeeIds, employee.id]); setShowAddEmployee(false); }}><span>{employee.firstName} {employee.lastName}<small>{employee.department}</small></span><b>+</b></button>)}</div>
        {!employees.some((employee) => employee.status === 'active' && !scheduledEmployeeIds.includes(employee.id)) && <p className={s.addDescription}>{t('All active employees are already on the schedule.')}</p>}
      </Modal>
    </div>
  );
}
