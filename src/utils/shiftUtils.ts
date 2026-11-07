import type { Shift, ShiftType } from '@/types';
import { addDays, toDateString } from './dateUtils';

export const SHIFT_HOURS: Record<ShiftType, { start: string; end: string }> = {
  DAY: { start: '07:00', end: '19:00' },
  NIGHT: { start: '19:00', end: '07:00' },
};

export interface ShiftSlot {
  date: string;
  type: ShiftType;
}

export function getShiftType(shift: Pick<Shift, 'type' | 'startTime'>): ShiftType {
  if (shift.type) return shift.type;
  if (!shift.startTime) return 'DAY';
  const hour = Number(shift.startTime.slice(0, 2));
  return hour >= 18 || hour < 6 ? 'NIGHT' : 'DAY';
}

export function getShiftTimes(shift: Pick<Shift, 'type' | 'startTime' | 'endTime'>) {
  const defaults = SHIFT_HOURS[getShiftType(shift)];
  return { start: shift.startTime || defaults.start, end: shift.endTime || defaults.end };
}

// A night shift belongs to the date it starts on, so 02:00 is still the previous day's night.
export function getCurrentSlot(now: Date = new Date()): ShiftSlot {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const dayStart = 7 * 60;
  const nightStart = 19 * 60;
  const today = toDateString(now);
  if (minutes < dayStart) return { date: addDays(today, -1), type: 'NIGHT' };
  if (minutes < nightStart) return { date: today, type: 'DAY' };
  return { date: today, type: 'NIGHT' };
}

export function getNextSlot(slot: ShiftSlot): ShiftSlot {
  return slot.type === 'DAY' ? { date: slot.date, type: 'NIGHT' } : { date: addDays(slot.date, 1), type: 'DAY' };
}

export function getPreviousSlot(slot: ShiftSlot): ShiftSlot {
  return slot.type === 'NIGHT' ? { date: slot.date, type: 'DAY' } : { date: addDays(slot.date, -1), type: 'NIGHT' };
}

export function isSameSlot(left: ShiftSlot, right: ShiftSlot): boolean {
  return left.date === right.date && left.type === right.type;
}

export function compareSlots(left: ShiftSlot, right: ShiftSlot): number {
  return left.date.localeCompare(right.date) || (left.type === right.type ? 0 : left.type === 'DAY' ? -1 : 1);
}

export function formatSlot(slot: ShiftSlot, translate: (key: string) => string = (key) => key, locale?: string): string {
  const [year, month, day] = slot.date.split('-').map(Number);
  const date = new Date(year, month - 1, day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date} · ${translate(slot.type === 'DAY' ? 'Day shift' : 'Night shift')}`;
}

// Night shift times before the night start (e.g. 02:00) belong to the next calendar day.
export function slotTimeToDate(slot: ShiftSlot, time: string): Date {
  const [year, month, day] = slot.date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(year, month - 1, day, hours, minutes);
  if (slot.type === 'NIGHT' && time < SHIFT_HOURS.NIGHT.start) result.setDate(result.getDate() + 1);
  return result;
}
