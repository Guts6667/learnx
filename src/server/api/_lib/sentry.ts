/**
 * Sends unexpected API errors to Sentry, on top of the log line.
 *
 * The log stream stays the primary record — it is written unconditionally and
 * costs nothing when nobody reads it. Sentry adds the part a log stream cannot
 * do alone: grouping the same failure across requests, and telling somebody it
 * is happening. If the DSN is absent, nothing here loads and nothing changes.
 *
 * The SDK is imported on the first error rather than at module load. A cold
 * start on Vercel pays for every import whether or not it is used, and the
 * overwhelming majority of requests never fail.
 *
 * Only errors are sent. No tracing, no profiling, no session data: those are
 * separate decisions with separate costs, and this ticket is about knowing that
 * production broke.
 */

import type { UnexpectedErrorEvent } from './error-reporting';

type SentryModule = typeof import('@sentry/node');

/** How long a serverless invocation may wait for delivery before answering. */
const FLUSH_TIMEOUT_MS = 2_000;

let loading: Promise<SentryModule | null> | null = null;

/**
 * Removes everything Sentry would otherwise attach about the request itself.
 *
 * `sendDefaultPii: false` already withholds cookies, headers and the body, but
 * the URL survives it — and our URLs carry record identifiers, which are
 * personal data by association. `describeUnexpectedError` collapses those in
 * the path it hands us; this makes sure the SDK does not reintroduce the raw
 * one behind its back.
 *
 * Exported because this is the guarantee worth testing, and it is testable
 * without the SDK.
 */
export function scrubRequestData<
  T extends { request?: unknown; user?: unknown },
>(event: T): T {
  delete event.request;
  delete event.user;
  return event;
}

function initialise(dsn: string, module: SentryModule): SentryModule {
  module.init({
    beforeSend: (event) => scrubRequestData(event),
    dsn,
    // Vercel sets this to production/preview/development; it is what separates
    // a real incident from a preview experiment in the Sentry UI.
    environment: process.env.VERCEL_ENV ?? 'development',
    // Errors are rare and each one matters. There is nothing to sample down.
    sampleRate: 1,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    // Errors only, deliberately. Tracing is a separate decision.
    tracesSampleRate: 0,
  });

  return module;
}

async function client(dsn: string): Promise<SentryModule | null> {
  loading ??= import('@sentry/node')
    .then((module) => initialise(dsn, module))
    .catch(() => null);

  return await loading;
}

/**
 * Sends one already-described error. Never throws and never rejects: a failure
 * to report must not become a second failure on top of the first.
 */
export async function captureUnexpectedError(
  error: unknown,
  event: UnexpectedErrorEvent,
  dsn: string | undefined = process.env.SENTRY_DSN,
): Promise<boolean> {
  if (!dsn) return false;

  try {
    const module = await client(dsn);
    if (!module) return false;

    module.captureException(error, {
      tags: { method: event.method, path: event.path },
      // The identifier the response already returned in X-Request-Id, so a
      // user saying "it failed" leads to the exact event.
      extra: { requestId: event.requestId },
    });

    // A serverless invocation is frozen the moment it answers, so an unflushed
    // event is a lost event.
    await module.flush(FLUSH_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

/** Test seam. Not part of the runtime contract. */
export const internals = {
  reset(): void {
    loading = null;
  },
};
