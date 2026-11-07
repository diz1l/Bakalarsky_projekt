export function getWeekDates(date: Date = new Date()): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

// Local calendar date (YYYY-MM-DD). toISOString() would shift dates in non-UTC time zones.
export function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: string, days: number): string {
  const d = parseDateString(value);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${minutes} ${ampm}`;
}

export function dayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Intervals whose end is not after the start run past midnight (e.g. 19:00–07:00).
export function hasTimeOverlap(
  s1: string, e1: string,
  s2: string, e2: string,
): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  const start1 = toMinutes(s1);
  const start2 = toMinutes(s2);
  let end1 = toMinutes(e1);
  let end2 = toMinutes(e2);
  if (end1 <= start1) end1 += 24 * 60;
  if (end2 <= start2) end2 += 24 * 60;
  return start1 < end2 && start2 < end1;
}
