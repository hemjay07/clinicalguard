/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Microsoft Clarity, injected by the host in production. Optional on purpose:
// every call site guards with `?.`, so local dev and any environment without
// the script behave identically — the tags are simply not emitted.
interface Window {
  clarity?: (...args: unknown[]) => void;
}
