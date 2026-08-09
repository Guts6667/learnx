import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import {
  createRequestObservability,
  type RequestLogEvent,
} from './observability.js';

describe('request observability', () => {
  it('correlates and times a request without logging query values or identifiers', async () => {
    const events: RequestLogEvent[] = [];
    const times = [100, 112.34];
    const app = new Hono();
    app.use(
      '*',
      createRequestObservability({
        now: () => times.shift() ?? 112.34,
        requestId: () => 'request-1',
        write: (_level, event) => events.push(event),
      }),
    );
    app.get('/api/notes/:id', (context) => context.json({ ok: true }));

    const response = await app.request(
      '/api/notes/93aa511e-5ab4-4705-99e7-943da6d17b77?search=private',
    );

    expect(response.headers.get('x-request-id')).toBe('request-1');
    expect(response.headers.get('server-timing')).toBe('app;dur=12.3');
    expect(events).toEqual([
      expect.objectContaining({
        durationMs: 12.3,
        path: '/api/notes/:id',
        requestId: 'request-1',
        status: 200,
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain('private');
  });

  it('can be disabled without removing correlation headers', async () => {
    const write = vi.fn();
    const app = new Hono();
    app.use(
      '*',
      createRequestObservability({
        enabled: false,
        now: () => 1,
        requestId: () => 'request-2',
        write,
      }),
    );
    app.get('/health', (context) => context.text('ok'));

    const response = await app.request('/health');
    expect(response.headers.get('x-request-id')).toBe('request-2');
    expect(write).not.toHaveBeenCalled();
  });
});
