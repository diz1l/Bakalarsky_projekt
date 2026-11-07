import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/scss/global.scss';
import App from './App';

async function enableMocking() {
  // Set VITE_USE_MOCKS=false to talk to the real backend (see backend/README.md).
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false') {
    const { worker } = await import('./mocks/browser');
    return worker.start({ onUnhandledRequest: 'bypass' });
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
