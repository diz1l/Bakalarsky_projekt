import type { ChecklistSection } from '@/types';

export const CHECKLIST_SECTIONS: { value: ChecklistSection; label: string }[] = [
  { value: 'start', label: 'At the start of shift' },
  { value: 'during', label: 'During the shift' },
  { value: 'end', label: 'At the end of shift' },
];
