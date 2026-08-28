import type { MiddlewareHandler } from 'hono';

const identifierPattern =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const SLOW_REQUEST_THRESHOLD_MS = 1_000;

export interface RequestLogEvent {
  durationMs: number;
  event: 'api_request';
  method: string;
  path: string;
  requestId: string;
  responseBytes: number | null;
  status: number;
}

function normalizePath(url: string): string {
  return new URL(url).pathname.replace(identifierPattern, ':id');
}

function responseSize(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function createRequestObservability(
  options: {
    enabled?: boolean;
    now?: () => number;
    requestId?: () => string;
    write?: (level: 'error' | 'info' | 'warn', event: RequestLogEvent) => void;
  } = {},
): MiddlewareHandler {
  const enabled =
    options.enabled ?? process.env.LEARNX_OBSERVABILITY_ENABLED !== 'false';
  const now = options.now ?? (() => performance.now());
  const requestId = options.requestId ?? (() => crypto.randomUUID());
  const write =
    options.write ??
    ((level, event) => {
      console[level](JSON.stringify(event));
    });

  return async (context, next) => {
    const id = requestId();
    const startedAt = now();
    let thrownStatus: number | undefined;
    context.header('X-Request-Id', id);

    try {
      await next();
    } catch (error) {
      thrownStatus =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof error.status === 'number'
          ? error.status
          : 500;
      throw error;
    } finally {
      const durationMs = Math.max(0, now() - startedAt);
      context.header('Server-Timing', `app;dur=${durationMs.toFixed(1)}`);
      if (enabled) {
        const event: RequestLogEvent = {
          durationMs: Number(durationMs.toFixed(1)),
          event: 'api_request',
          method: context.req.method,
          path: normalizePath(context.req.url),
          requestId: id,
          responseBytes: responseSize(
            context.res.headers.get('content-length') ?? undefined,
          ),
          status: thrownStatus ?? context.res.status,
        };
        const level =
          event.status >= 500
            ? 'error'
            : event.status >= 400 ||
                event.durationMs >= SLOW_REQUEST_THRESHOLD_MS
              ? 'warn'
              : 'info';
        write(level, event);
      }
    }
  };
}
