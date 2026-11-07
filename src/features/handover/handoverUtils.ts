import type { HandoverNote } from '@/types';

// A note waits for the user when they are an expected recipient and have not confirmed it yet.
export function needsMyAttention(note: HandoverNote, userId?: string): boolean {
  if (!userId || note.status === 'resolved' || note.authorId === userId) return false;
  if (!note.expectedRecipients?.some((recipient) => recipient.userId === userId)) return false;
  const ack = note.acknowledgements.find((entry) => entry.userId === userId);
  return !ack || (note.requiresAction && !ack.actionTakenAt && note.status === 'open');
}
