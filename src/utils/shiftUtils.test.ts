import { describe, expect, test } from 'vitest';
import { addDays, hasTimeOverlap, toDateString } from './dateUtils';
import { compareSlots, getCurrentSlot, getNextSlot, getPreviousSlot, getShiftType, slotTimeToDate } from './shiftUtils';

describe('dateUtils', () => {
  test('toDateString uses the local calendar date', () => {
    expect(toDateString(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01');
  });

  test('addDays crosses month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('hasTimeOverlap handles shifts past midnight', () => {
    expect(hasTimeOverlap('19:00', '07:00', '22:00', '23:00')).toBe(true);
    expect(hasTimeOverlap('19:00', '07:00', '07:00', '19:00')).toBe(false);
    expect(hasTimeOverlap('08:00', '16:00', '15:00', '23:00')).toBe(true);
    expect(hasTimeOverlap('', '', '08:00', '16:00')).toBe(false);
  });
});

describe('shift slots', () => {
  test('early morning belongs to the previous night shift', () => {
    expect(getCurrentSlot(new Date(2026, 10, 8, 2, 0))).toEqual({ date: '2026-11-07', type: 'NIGHT' });
    expect(getCurrentSlot(new Date(2026, 10, 8, 7, 0))).toEqual({ date: '2026-11-08', type: 'DAY' });
    expect(getCurrentSlot(new Date(2026, 10, 8, 19, 0))).toEqual({ date: '2026-11-08', type: 'NIGHT' });
  });

  test('next and previous slots alternate day and night', () => {
    const day = { date: '2026-11-07', type: 'DAY' as const };
    const night = getNextSlot(day);
    expect(night).toEqual({ date: '2026-11-07', type: 'NIGHT' });
    expect(getNextSlot(night)).toEqual({ date: '2026-11-08', type: 'DAY' });
    expect(getPreviousSlot(day)).toEqual({ date: '2026-11-06', type: 'NIGHT' });
    expect(compareSlots(day, night)).toBeLessThan(0);
  });

  test('shift type falls back to start time, and empty time means day', () => {
    expect(getShiftType({ startTime: '' })).toBe('DAY');
    expect(getShiftType({ startTime: '21:00' })).toBe('NIGHT');
    expect(getShiftType({ startTime: '21:00', type: 'DAY' })).toBe('DAY');
  });

  test('night shift times after midnight are on the next day', () => {
    expect(slotTimeToDate({ date: '2026-11-07', type: 'NIGHT' }, '02:00')).toEqual(new Date(2026, 10, 8, 2, 0));
    expect(slotTimeToDate({ date: '2026-11-07', type: 'NIGHT' }, '23:00')).toEqual(new Date(2026, 10, 7, 23, 0));
  });
});
