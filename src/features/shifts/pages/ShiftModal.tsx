import type { FormEventHandler, Dispatch, SetStateAction } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { Shift } from '@/types';
import { Modal } from '@/components/ui/Modal/Modal';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Button } from '@/components/ui/Button/Button';
import { useLocale } from '@/app/locale';
import s from './ShiftsPage.module.scss';

export interface ShiftFormValues {
  employeeId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  department: string;
  notes?: string;
}

interface ShiftModalProps {
  isOpen: boolean;
  editing: Shift | null;
  employeeName: string;
  shiftType: 'D' | 'N';
  setShiftType: Dispatch<SetStateAction<'D' | 'N'>>;
  register: UseFormRegister<ShiftFormValues>;
  errors: FieldErrors<ShiftFormValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange: FormEventHandler<HTMLFormElement>;
  onClose: () => void;
  conflict: string | null;
  loading: boolean;
  canDelete: boolean;
  onDelete: () => void;
}

const departments = ['Front Desk', 'Housekeeping', 'Restaurant', 'Maintenance'].map((value) => ({ value, label: value }));

export function ShiftModal({ isOpen, editing, employeeName, shiftType, setShiftType, register, errors, onSubmit, onChange, onClose, conflict, loading, canDelete, onDelete }: ShiftModalProps) {
  const { t } = useLocale();
  return <Modal isOpen={isOpen} onClose={onClose} title={editing ? t('Edit Shift') : t('New Shift')}>
    <form onSubmit={onSubmit} onChange={onChange}>
      <input type="hidden" {...register('employeeId')} />
      <div className={s.assignedTo}>{t('Assigned to')} <strong>{employeeName}</strong></div>
      <div className={s.typePicker} aria-label={t('Shift type')}>
        <button type="button" className={shiftType === 'D' ? s.selectedType : ''} onClick={() => setShiftType('D')}><b>D</b><span>{t('Day shift')}</span></button>
        <button type="button" className={shiftType === 'N' ? s.selectedType : ''} onClick={() => setShiftType('N')}><b>N</b><span>{t('Night shift')}</span></button>
      </div>
      <FormField label={t('Date')} error={errors.date?.message} required><Input type="date" {...register('date')} error={!!errors.date} /></FormField>
      <div className={s.timeRow}>
        <FormField label={t('Start (optional)')} error={errors.startTime?.message}><Input type="time" {...register('startTime')} error={!!errors.startTime} /></FormField>
        <FormField label={t('End (optional)')} error={errors.endTime?.message}><Input type="time" {...register('endTime')} error={!!errors.endTime} /></FormField>
      </div>
      <FormField label={t('Department')} error={errors.department?.message} required><Select options={departments.map((item) => ({ ...item, label: t(item.label) }))} {...register('department')} error={!!errors.department} /></FormField>
      <FormField label={t('Notes')}><Input {...register('notes')} /></FormField>
      {conflict && <div className={s.conflict}>⚠ {conflict}</div>}
      <div className={s.formActions}>
        {editing && canDelete && <Button variant="danger" type="button" onClick={onDelete}>{t('Delete')}</Button>}
        <Button variant="secondary" type="button" onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" loading={loading}>{editing ? t('Save') : t('Create')}</Button>
      </div>
    </form>
  </Modal>;
}
