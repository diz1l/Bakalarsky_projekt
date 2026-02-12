import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './server';
import { store } from '@/app/store';
import { logout } from '@/features/auth/slices/authSlice';
import { resetMockDb } from '@/mocks/data/db';

const NativeRequest = globalThis.Request;

class RequestWithoutSignal extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init && 'signal' in init) {
      const requestInit: RequestInit = { ...init };
      delete requestInit.signal;
      super(input, requestInit);
      return;
    }

    super(input, init);
  }
}

Object.defineProperty(globalThis, 'Request', {
  configurable: true,
  value: RequestWithoutSignal,
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  localStorage.clear();
  resetMockDb();
  store.dispatch(logout());
  window.history.pushState({}, 'Test', '/');
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});
