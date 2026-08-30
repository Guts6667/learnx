/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Browser DSN for Sentry. Absent means the reporter never loads, which is
   * what happens in development and in any environment that has not set it.
   *
   * A browser DSN is not a secret: it ships inside the bundle by design, and
   * grants only the right to send events to one project. The `VITE_` prefix is
   * the reminder — Vite exposes nothing else to client code.
   */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
