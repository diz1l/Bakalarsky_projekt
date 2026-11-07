// Shared by the RTK Query client and the MSW handlers so mocks intercept the same URLs.
export const API_BASE_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

// Without a configured API a production build runs as a self-contained demo on mock data.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
  || (import.meta.env.VITE_USE_MOCKS !== 'false' && (import.meta.env.DEV || !import.meta.env.VITE_API_URL));
