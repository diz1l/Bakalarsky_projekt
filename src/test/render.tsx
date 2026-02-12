import type { ReactElement } from 'react';
import { render } from '@testing-library/react';

export function renderAtRoute(ui: ReactElement, route: string) {
  window.history.pushState({}, 'Test', route);
  return render(ui);
}
