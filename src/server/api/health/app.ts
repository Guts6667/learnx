import { Hono } from 'hono';

/**
 * Liveness of the API and of its database, for anything that watches from
 * outside — a scheduled smoke check, an uptime probe, a person after a deploy.
 *
 * Three incidents in two days were each found by a person rather than by a
 * signal: a public form that never worked, a preview environment that could not
 * reach any database, and a production schema that had been dropped. This route
 * is the smallest thing that turns the second and third of those into an alert.
 *
 * It answers publicly and must therefore stay mounted above every app that
 * guards `*`, and must never leak anything a stranger should not read: no
 * connection string, no host, no counts, no error text from the driver.
 */

/** A probe that hangs is a probe that reports nothing. */
const DEFAULT_TIMEOUT_MS = 2_000;

export interface HealthAppOptions {
  /** Injected in tests; production passes the real client through. */
  ping?: () => Promise<unknown>;
  timeoutMs?: number;
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<'ok' | 'unreachable'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return 'ok';
  } catch {
    // Deliberately swallowed: the driver's message can name a host or a role.
    // The caller learns reachable or not, and the request log carries the rest.
    return 'unreachable';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createHealthApp(options: HealthAppOptions = {}) {
  const app = new Hono();
  // Imported lazily and on purpose. Constructing the client at module load
  // requires DATABASE_URL, so a static import would make merely *importing*
  // the health route fail wherever the variable is absent — including the
  // tests that exist to prove the route reports a database being absent.
  const ping =
    options.ping ??
    (async () => {
      const { prisma } = await import('../../prisma.js');
      return prisma.$queryRaw`SELECT 1`;
    });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  app.get('/api/health', async (context) => {
    const database = await withTimeout(ping, timeoutMs);
    const healthy = database === 'ok';

    return context.json(
      {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'unknown',
        database,
        environment: process.env.VERCEL_ENV ?? 'development',
        region: process.env.VERCEL_REGION ?? 'unknown',
        status: healthy ? 'ok' : 'degraded',
      },
      healthy ? 200 : 503,
    );
  });

  return app;
}

export const healthApp = createHealthApp();
