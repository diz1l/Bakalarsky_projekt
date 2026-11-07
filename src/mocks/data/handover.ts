import type { HandoverNote, HandoverStatus } from '@/types';
import { compareSlots, getCurrentSlot, getNextSlot, getShiftType } from '@/utils/shiftUtils';
import { db, persistMockCollections } from './db';

// Recipients are the people scheduled on the target shift; with nobody scheduled, the whole department.
export function getExpectedRecipients(note: HandoverNote): { userId: string; name: string }[] {
  const inDepartment = (department: string) => note.department === 'ALL' || department === note.department;

  const scheduledIds = new Set(
    db.shifts
      .filter(
        (shift) =>
          shift.date === note.targetDate &&
          getShiftType(shift) === note.targetShiftType &&
          shift.status !== 'cancelled' &&
          inDepartment(shift.department),
      )
      .map((shift) => shift.employeeId),
  );

  const candidates = db.employees.filter(
    (employee) => employee.status === 'active' && employee.userId && employee.userId !== note.authorId,
  );
  const scheduled = candidates.filter((employee) => scheduledIds.has(employee.id));
  const recipients = scheduled.length ? scheduled : candidates.filter((employee) => inDepartment(employee.department));

  return recipients.map((employee) => ({
    userId: employee.userId!,
    name: `${employee.firstName} ${employee.lastName}`,
  }));
}

export function computeHandoverStatus(note: HandoverNote): HandoverStatus {
  if (note.resolvedAt) return 'resolved';
  const confirmed = note.acknowledgements.some((ack) => (note.requiresAction ? ack.actionTakenAt : ack.readAt));
  return confirmed ? 'acknowledged' : 'open';
}

export function withRecipients(note: HandoverNote): HandoverNote {
  return { ...note, status: computeHandoverStatus(note), expectedRecipients: getExpectedRecipients(note) };
}

// Unhandled action items are forwarded to the next shift instead of silently expiring.
export function forwardOverdueHandovers(now: Date = new Date()) {
  const current = getCurrentSlot(now);
  let changed = false;
  for (const note of db.handoverNotes) {
    if (!note.requiresAction || computeHandoverStatus(note) !== 'open') continue;
    let target = { date: note.targetDate, type: note.targetShiftType };
    while (compareSlots(target, current) < 0) target = getNextSlot(target);
    if (target.date !== note.targetDate || target.type !== note.targetShiftType) {
      note.targetDate = target.date;
      note.targetShiftType = target.type;
      changed = true;
    }
  }
  if (changed) persistMockCollections();
}
