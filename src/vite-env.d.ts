/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: string;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
