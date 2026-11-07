import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import type { Shift } from '@/types';
import s from './ShiftsPage.module.scss';
import { useLocale } from '@/app/locale';
import { useDeleteAbsenceMutation, useGetAbsencesQuery, useSaveAbsenceMutation } from '../api/absencesApi';
import { ScheduleGrid } from './ScheduleGrid';
import { ShiftModal } from './ShiftModal';
import { getShiftType } from '@/utils/shiftUtils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';

const shiftSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  notes: z.string().optional(),
});
type ShiftFormData = z.infer<typeof shiftSchema>;

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
  const { data: absences = [] } = useGetAbsencesQuery({ from: weekStart, to: endDate });
  const { data: employees = [] } = useGetEmployeesQuery();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [updateShift, { isLoading: updating }] = useUpdateShiftMutation();
  const [deleteShift, { isLoading: deletingShift }] = useDeleteShiftMutation();
  const [saveAbsence] = useSaveAbsenceMutation();
  const [deleteAbsence] = useDeleteAbsenceMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [roster, setRoster] = useState<string[] | null>(() => { const saved = localStorage.getItem('staff-shift-roster'); return saved ? JSON.parse(saved) as string[] : null; });
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [statusTarget, setStatusTarget] = useState<{ employeeId: string; date: string } | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [shiftType, setShiftType] = useState<'D' | 'N'>('D');
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const updateRoster = (next: string[]) => { setRoster(next); localStorage.setItem('staff-shift-roster', JSON.stringify(next)); };
  const activeEmployees = employees.filter((employee) => employee.status === 'active');
  const scheduledEmployeeIds = roster ?? activeEmployees.map((employee) => employee.id);
  const currentEmployee = employees.find((employee) => employee.userId === user?.id);

  const visibleShifts = can('shifts.viewAll')
    ? shifts
    : shifts.filter((sh) => sh.employeeId === currentEmployee?.id);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
  });

  const [watchDate, watchEmpId, watchStart, watchEnd] = useWatch({ control, name: ['date', 'employeeId', 'startTime', 'endTime'] });

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
    setShiftType(getShiftType(shift) === 'NIGHT' ? 'N' : 'D');
    setConflict(null);
    reset({ employeeId: shift.employeeId, date: shift.date, startTime: shift.startTime, endTime: shift.endTime, department: shift.department, notes: shift.notes || '' });
    setModalOpen(true);
  };

  const chooseStatus = async (code: 'D' | 'N' | 'H' | 'S' | '×') => {
    if (!statusTarget) return;
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
    } else {
      const type = code === 'H' ? 'PAID_LEAVE' : code === 'S' ? 'SICK' : 'UNAVAILABLE';
      try {
        await saveAbsence({ employeeId: statusTarget.employeeId, date: statusTarget.date, type }).unwrap();
      } catch {
        showToast('Unable to save absence', 'error');
      }
    }
  };

  const onSubmit = async (data: ShiftFormData) => {
    const emp = employees.find((e) => e.id === data.employeeId);
    const body = { ...data, type: shiftType === 'N' ? 'NIGHT' as const : 'DAY' as const, startTime: data.startTime || '', endTime: data.endTime || '', employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown', status: 'scheduled' as const };
    try {
      if (editing) {
        await updateShift({ ...editing, ...body }).unwrap();
        showToast('Shift updated', 'success');
      } else {
        await createShift(body).unwrap();
        showToast('Shift created', 'success');
      }
      setModalOpen(false);
    } catch {
      showToast('Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteShift(id).unwrap();
      showToast('Shift deleted', 'success');
      setShiftToDelete(null);
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const clearAbsence = async (employeeId: string, date: string) => {
    const absence = absences.find((item) => item.employeeId === employeeId && item.date === date);
    if (!absence) return;
    try {
      await deleteAbsence(absence.id).unwrap();
    } catch {
      showToast('Unable to remove absence', 'error');
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
      <ScheduleGrid
        employees={employees.filter((employee) => employee.status === 'active' && (can('shifts.viewAll') ? scheduledEmployeeIds.includes(employee.id) : employee.id === currentEmployee?.id))}
        dates={monthDates} shifts={visibleShifts} absences={absences}
        canCreate={can('shifts.create')} canEdit={can('shifts.edit')} canDelete={can('shifts.delete')} canManageRoster={can('shifts.viewAll')}
        onEdit={openEdit}
        onPickStatus={(employee, date) => { setStatusTarget({ employeeId: employee.id, date }); setStatusModalOpen(true); }}
        onDeleteShift={setShiftToDelete}
        onClearAbsence={(employeeId, date) => { void clearAbsence(employeeId, date); }}
        onRemoveEmployee={(employeeId) => updateRoster(scheduledEmployeeIds.filter((id) => id !== employeeId))}
      />

      <ShiftModal isOpen={modalOpen} editing={editing} employeeName={employees.find((employee) => employee.id === assignedEmployeeId)?.firstName ? `${employees.find((employee) => employee.id === assignedEmployeeId)?.firstName} ${employees.find((employee) => employee.id === assignedEmployeeId)?.lastName}` : ''} shiftType={shiftType} setShiftType={setShiftType} register={register} errors={errors} onSubmit={handleSubmit(onSubmit)} onChange={checkConflict} onClose={() => setModalOpen(false)} conflict={conflict} loading={creating || updating} canDelete={can('shifts.delete')} onDelete={() => { if (editing) { setShiftToDelete(editing.id); setModalOpen(false); } }} />
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title={t('Choose schedule entry')}>
        <div className={s.statusChoices}>
          <button className={s.codeD} onClick={() => chooseStatus('D')}><b>D</b><span>{t('Day shift')}</span></button>
          <button className={s.codeN} onClick={() => chooseStatus('N')}><b>N</b><span>{t('Night shift')}</span></button>
          <button className={s.codeH} onClick={() => chooseStatus('H')}><b>H</b><span>{t('Paid leave')}</span></button>
          <button className={s.codeS} onClick={() => chooseStatus('S')}><b>S</b><span>{t('Sick')}</span></button>
          <button className={s.codeX} onClick={() => chooseStatus('×')}><b>×</b><span>{t('Unavailable')}</span></button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={!!shiftToDelete} title={t('Delete shift?')} message={t('This will remove the shift from the schedule.')} loading={deletingShift} onClose={() => setShiftToDelete(null)} onConfirm={() => { if (shiftToDelete) void handleDelete(shiftToDelete); }} confirmLabel={t('Delete')} cancelLabel={t('Cancel')} />
      <Modal isOpen={showAddEmployee} onClose={() => setShowAddEmployee(false)} title={t('Add employee to schedule')}>
        <p className={s.addDescription}>{t("Choose an active employee to add as a new row in this hotel's roster.")}</p>
        <div className={s.employeePicker}>{employees.filter((employee) => employee.status === 'active' && !scheduledEmployeeIds.includes(employee.id)).map((employee) => <button key={employee.id} onClick={() => { updateRoster([...scheduledEmployeeIds, employee.id]); setShowAddEmployee(false); }}><span>{employee.firstName} {employee.lastName}<small>{employee.department}</small></span><b>+</b></button>)}</div>
        {!employees.some((employee) => employee.status === 'active' && !scheduledEmployeeIds.includes(employee.id)) && <p className={s.addDescription}>{t('All active employees are already on the schedule.')}</p>}
      </Modal>
    </div>
  );
}
