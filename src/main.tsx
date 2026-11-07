import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/scss/global.scss';
import App from './App';
import { USE_MOCKS } from '@/app/apiConfig';

async function enableMocking() {
  // See src/app/apiConfig.ts: VITE_USE_MOCKS=false (or a VITE_API_URL in production) uses the real backend.
  if (USE_MOCKS) {
    const { worker } = await import('./mocks/browser');
    return worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
