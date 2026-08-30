/**
 * Browser error reporting, loaded late on purpose.
 *
 * The SDK is 27 KB gzip. The initial bundle is budgeted at 125 KB and sits
 * near 115 KB, so importing it the usual way — at the top of `main.tsx` —
 * would spend a quarter of the remaining headroom on a file that matters only
 * once something has already gone wrong, and would slow the first paint for
 * every learner, including the ones on the slow connections this PWA exists to
 * serve.
 *
 * So the SDK is fetched as its own chunk once the page is idle, and until it
 * arrives two listeners hold whatever fails. Nothing from the startup window is
 * lost; it is reported a moment later.
 *
 * What this costs, stated plainly: there is no page-load transaction, because
 * tracing is stripped from the build entirely. Errors were the point.
 */

import type { SentryClient } from './sentry-client';

type BufferedError = {
  componentStack?: string;
  error: unknown;
  source: 'window.error' | 'unhandledrejection' | 'react';
};

/** Small enough to be worthless as a leak, large enough for a failing boot. */
const MAX_BUFFERED = 20;

/** Long enough to be past the first paint on a slow phone. */
const IDLE_FALLBACK_MS = 2_000;

const buffered: BufferedError[] = [];

let client: SentryClient | null = null;
let started = false;

function send(entry: BufferedError): void {
  client?.captureException(entry.error, {
    tags: { reportedVia: entry.source },
    ...(entry.componentStack
      ? { extra: { componentStack: entry.componentStack } }
      : {}),
  });
}

function remember(entry: BufferedError): void {
  if (client) {
    send(entry);
    return;
  }

  // Dropping the oldest would lose the first failure, which is usually the one
  // that explains the rest.
  if (buffered.length < MAX_BUFFERED) buffered.push(entry);
}

function onWindowError(event: ErrorEvent): void {
  remember({ error: event.error ?? event.message, source: 'window.error' });
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  remember({ error: event.reason, source: 'unhandledrejection' });
}

/**
 * Reports an error React handed us, with the component stack it came with.
 * Passed to `createRoot`'s hooks, which React 19 calls for uncaught, caught and
 * recoverable render errors.
 *
 * This is a local shim rather than the SDK's `reactErrorHandler`, because the
 * root is created long before the SDK exists.
 */
export function reportReactError(
  error: unknown,
  info?: { componentStack?: string },
): void {
  remember({
    componentStack: info?.componentStack,
    error,
    source: 'react',
  });
}

/** Runs `work` when the browser is next idle, or soon, where that is missing. */
function whenIdle(work: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      work();
    });
    return;
  }

  window.setTimeout(work, IDLE_FALLBACK_MS);
}

async function load(dsn: string): Promise<void> {
  const { initialiseSentry } = await import('./sentry-client');

  client = initialiseSentry(dsn);

  // Sentry installs its own global handlers, so ours would double every event
  // from here on.
  window.removeEventListener('error', onWindowError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);

  for (const entry of buffered.splice(0)) send(entry);
}

/**
 * Starts buffering immediately and schedules the SDK. Safe to call twice; the
 * second call does nothing. Without a DSN nothing is installed and nothing is
 * fetched, which is what happens in development.
 */
export function startErrorReporting(
  dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN,
): void {
  if (started || !dsn) return;
  started = true;

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  whenIdle(() => {
    void load(dsn).catch(() => {
      // A reporter that cannot load must not become the thing that breaks the
      // page. The listeners stay, so the buffer keeps filling.
    });
  });
}

/** Test seam. Not part of the runtime contract. */
export const internals = {
  buffered,
  reset(): void {
    buffered.length = 0;
    client = null;
    started = false;
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  },
};
