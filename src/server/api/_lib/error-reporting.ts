/**
 * What happens to an error nobody expected.
 *
 * The API answers `INTERNAL_ERROR` and says no more, which is right: a stranger
 * learns nothing from a stack trace. But until now nothing else happened
 * either, so an unknown failure left no trace at all and every 500 looked
 * identical from the outside.
 *
 * The record is written to the log stream the platform already collects, in the
 * same JSON shape as the request log, and correlated by the identifier the
 * response returns in `X-Request-Id` — so a report of "it failed" leads to the
 * exact failure.
 */

const identifierPattern =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export interface UnexpectedErrorContext {
  method: string;
  path: string;
  requestId: string | null;
}

export interface UnexpectedErrorEvent extends UnexpectedErrorContext {
  event: 'api_unexpected_error';
  message: string;
  name: string;
  stack: string | null;
}

/**
 * Paths carry record identifiers, which are personal data by association. The
 * request log already collapses them; an error log that did not would reopen
 * the hole the request log closes.
 */
export function normalizeLoggedPath(url: string): string {
  return new URL(url).pathname.replace(identifierPattern, ':id');
}

/**
 * Only the error's own shape is described. Nothing from the request body, the
 * headers, the query string or the session is read here — an error report is
 * the one place where the temptation to attach "just a bit of context" ends up
 * copying a password into a log.
 */
export function describeUnexpectedError(
  error: unknown,
  context: UnexpectedErrorContext,
): UnexpectedErrorEvent {
  const isError = error instanceof Error;

  return {
    event: 'api_unexpected_error',
    message: isError ? error.message : String(error),
    method: context.method,
    name: isError ? error.name : typeof error,
    path: context.path,
    requestId: context.requestId,
    stack: isError ? (error.stack ?? null) : null,
  };
}

export function reportUnexpectedError(
  error: unknown,
  context: UnexpectedErrorContext,
  write: (event: UnexpectedErrorEvent) => void = (event) => {
    console.error(JSON.stringify(event));
  },
): UnexpectedErrorEvent {
  const event = describeUnexpectedError(error, context);
  write(event);
  return event;
}
