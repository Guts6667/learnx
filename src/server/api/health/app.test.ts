import { describe, expect, it } from 'vitest';

import { createHealthApp } from './app';

describe('GET /api/health', () => {
  it('answers 200 when the database replies', async () => {
    const app = createHealthApp({ ping: async () => [{ '?column?': 1 }] });

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      database: 'ok',
      status: 'ok',
    });
  });

  it('answers 503 when the database is unreachable', async () => {
    const app = createHealthApp({
      ping: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });

    const response = await app.request('/api/health');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      database: 'unreachable',
      status: 'degraded',
    });
  });

  it('answers 503 rather than hanging when the database does not reply', async () => {
    // A probe that hangs reports nothing, which is worse than reporting a
    // failure: the watcher sees a timeout it cannot distinguish from its own.
    const app = createHealthApp({
      ping: () => new Promise(() => {}),
      timeoutMs: 10,
    });

    const response = await app.request('/api/health');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      database: 'unreachable',
    });
  });

  it('tells a stranger nothing about where the database lives', async () => {
    const app = createHealthApp({
      ping: async () => {
        throw new Error(
          'connect ECONNREFUSED ep-rapid-brook.eu-central-1.aws.neon.tech:5432 role neondb_owner',
        );
      },
    });

    const body = await (await app.request('/api/health')).text();

    expect(body).not.toContain('ep-rapid-brook');
    expect(body).not.toContain('neondb_owner');
    expect(body).not.toContain('ECONNREFUSED');
  });
});
