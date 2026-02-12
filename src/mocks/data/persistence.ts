import type { Announcement, Notification } from '@/types';

const MOCK_STATE_KEY = 'staff_manager_mock_state_v1';

export interface MockPersistedState {
  notifications: Notification[];
  announcements: Announcement[];
}

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function readMockState(): Partial<MockPersistedState> {
  if (!canUseStorage()) return {};

  const raw = localStorage.getItem(MOCK_STATE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Partial<MockPersistedState>;
  } catch {
    localStorage.removeItem(MOCK_STATE_KEY);
    return {};
  }
}

export function loadMockState(): Partial<MockPersistedState> {
  return readMockState();
}

export function saveMockState(next: Partial<MockPersistedState>) {
  if (!canUseStorage()) return;
  const current = readMockState();
  localStorage.setItem(MOCK_STATE_KEY, JSON.stringify({ ...current, ...next }));
}

export function resetMockState() {
  if (!canUseStorage()) return;
  localStorage.removeItem(MOCK_STATE_KEY);
}
