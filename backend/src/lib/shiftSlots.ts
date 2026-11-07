// Same rules as the frontend (src/utils/shiftUtils.ts): a night shift belongs to the date it starts on.
export type ShiftType = 'DAY' | 'NIGHT';
export interface ShiftSlot { date: string; type: ShiftType }

const HOTEL_TZ = process.env.HOTEL_TZ ?? 'Europe/Prague';

function hotelNow(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getCurrentSlot(now: Date = new Date()): ShiftSlot {
  const { date, minutes } = hotelNow(now);
  if (minutes < 7 * 60) return { date: addDays(date, -1), type: 'NIGHT' };
  if (minutes < 19 * 60) return { date, type: 'DAY' };
  return { date, type: 'NIGHT' };
}

export const getNextSlot = (slot: ShiftSlot): ShiftSlot =>
  slot.type === 'DAY' ? { date: slot.date, type: 'NIGHT' } : { date: addDays(slot.date, 1), type: 'DAY' };

export const getPreviousSlot = (slot: ShiftSlot): ShiftSlot =>
  slot.type === 'NIGHT' ? { date: slot.date, type: 'DAY' } : { date: addDays(slot.date, -1), type: 'NIGHT' };

export const compareSlots = (left: ShiftSlot, right: ShiftSlot): number =>
  left.date.localeCompare(right.date) || (left.type === right.type ? 0 : left.type === 'DAY' ? -1 : 1);

export function shiftTypeFromTime(startTime?: string): ShiftType {
  if (!startTime) return 'DAY';
  const hour = Number(startTime.slice(0, 2));
  return hour >= 18 || hour < 6 ? 'NIGHT' : 'DAY';
}
