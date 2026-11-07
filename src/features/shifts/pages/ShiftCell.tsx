import type { Absence, Shift } from '@/types';
import { formatTime } from '@/utils/dateUtils';
import { getShiftType } from '@/utils/shiftUtils';
import { useLocale } from '@/app/locale';
import s from './ShiftsPage.module.scss';

interface ShiftCellProps {
  shift?: Shift;
  absence?: Absence;
  date: string;
  today: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRequest: boolean;
  onEdit: (shift: Shift) => void;
  onPickStatus: () => void;
  onDeleteShift: (id: string) => void;
  onClearAbsence: () => void;
}

export function ShiftCell({ shift, absence, date, today, canCreate, canEdit, canDelete, canRequest, onEdit, onPickStatus, onDeleteShift, onClearAbsence }: ShiftCellProps) {
  const { t } = useLocale();
  const absenceCode = absence ? { PAID_LEAVE: 'H', SICK: 'S', UNAVAILABLE: '×' }[absence.type] : '';
  const code = absenceCode || (shift ? getShiftType(shift) === 'NIGHT' ? 'N' : 'D' : '');
  const styleCode = code === '×' ? 'X' : code;
  const title = shift
    ? `${shift.startTime && shift.endTime ? `${formatTime(shift.startTime)}–${formatTime(shift.endTime)} · ` : ''}${shift.department}`
    : t('Choose shift type');

  return <button className={`${s.shiftCellButton} ${code ? s[`code${styleCode}`] : ''} ${today ? s.todayCell : ''}`} data-date={date} title={title} disabled={!shift && !canCreate && (!canRequest || !!absence)} onClick={() => { if (shift && canEdit) onEdit(shift); else if (absence && canCreate) onPickStatus(); else if (!absence && (canRequest || canCreate)) onPickStatus(); }} onContextMenu={(event) => { event.preventDefault(); if (shift && canDelete) onDeleteShift(shift.id); else if (absence && canCreate) onClearAbsence(); }}>
      {code || (canCreate || canRequest ? '+' : '—')}
    </button>;
}
