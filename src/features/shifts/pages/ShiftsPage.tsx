import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGetShiftsQuery, useCreateShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation } from '../api/shiftsApi';
import { useGetEmployeesQuery } from '@/features/employees/api/employeesApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { getWeekDates, toDateString, dayName, formatTime, hasTimeOverlap } from '@/utils/dateUtils';
import { Button } from '@/components/ui/Button/Button';
import { Modal } from '@/components/ui/Modal/Modal';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Badge } from '@/components/ui/Badge/Badge';
import type { Shift } from '@/types';
import s from './ShiftsPage.module.scss';

const shiftSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
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
  const [weekOffset, setWeekOffset] = useState(0);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const weekStart = toDateString(weekDates[0]);

  const { data: shifts = [] } = useGetShiftsQuery({ weekStart });
  const { data: employees = [] } = useGetEmployeesQuery();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [updateShift, { isLoading: updating }] = useUpdateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

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

  const openCreate = (date?: string) => {
    setEditing(null);
    setConflict(null);
    reset({ employeeId: '', date: date || '', startTime: '09:00', endTime: '17:00', department: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setConflict(null);
    reset({ employeeId: shift.employeeId, date: shift.date, startTime: shift.startTime, endTime: shift.endTime, department: shift.department, notes: shift.notes || '' });
    setModalOpen(true);
  };

  const onSubmit = async (data: ShiftFormData) => {
    const emp = employees.find((e) => e.id === data.employeeId);
    const body = { ...data, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown', status: 'scheduled' as const };
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
    if (!confirm('Delete this shift?')) return;
    try {
      await deleteShift(id).unwrap();
      showToast('Shift deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const empOptions = employees.filter((e) => e.status === 'active').map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));

  return (
    <div>
      <div className={s.toolbar}>
        <h1>Shifts</h1>
        <div className={s.weekNav}>
          <Button variant="secondary" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>← Prev</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>This Week</Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>Next →</Button>
        </div>
        {can('shifts.create') && <Button onClick={() => openCreate()}>Add Shift</Button>}
      </div>

      <div className={s.weekGrid}>
        {weekDates.map((date) => {
          const dateStr = toDateString(date);
          const dayShifts = visibleShifts.filter((sh) => sh.date === dateStr);
          const isToday = dateStr === toDateString(new Date());

          return (
            <div key={dateStr} className={`${s.dayCol} ${isToday ? s.today : ''}`}>
              <div className={s.dayHeader}>
                <span className={s.dayName}>{dayName(date)}</span>
                <span className={s.dayDate}>{date.getDate()}</span>
              </div>
              <div className={s.dayBody}>
                {dayShifts.map((sh) => (
                  <div key={sh.id} className={s.shiftCard} onClick={() => can('shifts.edit') ? openEdit(sh) : undefined}>
                    <div className={s.shiftName}>{sh.employeeName}</div>
                    <div className={s.shiftTime}>{formatTime(sh.startTime)} – {formatTime(sh.endTime)}</div>
                    <Badge variant={sh.status === 'completed' ? 'success' : sh.status === 'cancelled' ? 'danger' : 'info'}>
                      {sh.status}
                    </Badge>
                    {can('shifts.delete') && (
                      <button className={s.delBtn} onClick={(e) => { e.stopPropagation(); handleDelete(sh.id); }}>×</button>
                    )}
                  </div>
                ))}
                {can('shifts.create') && (
                  <button className={s.addDay} onClick={() => openCreate(dateStr)}>+ Add</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Shift' : 'New Shift'}>
        <form onSubmit={handleSubmit(onSubmit)} onChange={checkConflict}>
          <FormField label="Employee" error={errors.employeeId?.message} required>
            <Select options={empOptions} placeholder="Select employee" {...register('employeeId')} error={!!errors.employeeId} />
          </FormField>
          <FormField label="Date" error={errors.date?.message} required>
            <Input type="date" {...register('date')} error={!!errors.date} />
          </FormField>
          <div className={s.timeRow}>
            <FormField label="Start" error={errors.startTime?.message} required>
              <Input type="time" {...register('startTime')} error={!!errors.startTime} />
            </FormField>
            <FormField label="End" error={errors.endTime?.message} required>
              <Input type="time" {...register('endTime')} error={!!errors.endTime} />
            </FormField>
          </div>
          <FormField label="Department" error={errors.department?.message} required>
            <Select options={DEPARTMENTS} placeholder="Select department" {...register('department')} error={!!errors.department} />
          </FormField>
          <FormField label="Notes">
            <Input {...register('notes')} />
          </FormField>
          {conflict && <div className={s.conflict}>⚠ {conflict}</div>}
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creating || updating}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
