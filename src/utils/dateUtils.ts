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

export function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${minutes} ${ampm}`;
}

export function dayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function hasTimeOverlap(
  s1: string, e1: string,
  s2: string, e2: string,
): boolean {
  return s1 < e2 && s2 < e1;
}
