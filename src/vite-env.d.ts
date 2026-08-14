/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT_LABEL?: string;
  readonly VITE_DISPATCHER_API_URL?: string;
  readonly VITE_DISPATCHER_API_BASE?: string;
  readonly VITE_USE_DISPATCHER_MOCKS?: string;
  readonly VITE_DEFAULT_ROLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
