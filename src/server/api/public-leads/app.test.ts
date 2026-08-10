import { describe, expect, it, vi } from 'vitest';

import { createPublicLeadsApp } from './app';
import type {
  PublicLeadRepository,
  PublicLeadServiceDependencies,
} from './service';

function createContext() {
  const rows: Parameters<PublicLeadRepository['export']>[0][] = [];
  const repository: PublicLeadRepository = {
    convertToAccessRequest: vi.fn(
      async () => '00000000-0000-4000-8000-000000000003',
    ),
    confirm: vi.fn(async () => true),
    delete: vi.fn(async () => true),
    export: vi.fn(async (input) => {
      rows.push(input);
      return [
        {
          confirmedAt: new Date('2026-08-10T10:00:00Z'),
          createdAt: new Date('2026-08-10T09:00:00Z'),
          emailNormalized: 'reader@example.com',
          id: '00000000-0000-4000-8000-000000000004',
          locale: 'fr',
          motivation: null,
          purpose: 'LAUNCH_UPDATES',
          status: 'CONFIRMED',
        },
      ] satisfies Awaited<ReturnType<PublicLeadRepository['export']>>;
    }),
    issue: vi.fn(async () => 'lead-id'),
    list: vi.fn(async () => ({
      earlyAdopterApplications: 1,
      items: [
        {
          createdAt: new Date('2026-08-10T09:00:00Z'),
          emailNormalized: 'reader@example.com',
          id: '00000000-0000-4000-8000-000000000004',
          purposes: [
            {
              confirmedAt: new Date('2026-08-10T10:00:00Z'),
              createdAt: new Date('2026-08-10T09:00:00Z'),
              locale: 'fr',
              motivation: null,
              purpose: 'LAUNCH_UPDATES',
              status: 'CONFIRMED',
            },
            {
              confirmedAt: null,
              createdAt: new Date('2026-08-10T09:30:00Z'),
              locale: 'fr',
              motivation: 'Je souhaite contribuer aux retours produit.',
              purpose: 'EARLY_ADOPTER',
              status: 'PENDING_CONFIRMATION',
            },
          ],
        },
      ],
      launchUpdatesConfirmed: 1,
      limit: 25,
      offset: 0,
      total: 1,
    }) satisfies Awaited<ReturnType<PublicLeadRepository['list']>>),
    unsubscribe: vi.fn(async () => true),
  };
  const sent: Array<{ email: string; purpose: string }> = [];
  const dependencies: PublicLeadServiceDependencies = {
    appUrl: 'https://learn-x.app',
    createId: () => '00000000-0000-4000-8000-000000000001',
    createToken: vi
      .fn()
      .mockReturnValueOnce('confirmation-token-that-is-long-enough')
      .mockReturnValueOnce('management-token-that-is-long-enough'),
    emailProvider: {
      send: vi.fn(async (input) => {
        sent.push({ email: input.email, purpose: input.purpose });
      }),
    },
    now: () => new Date('2026-08-10T09:00:00Z'),
    repository,
    ttlMilliseconds: 86_400_000,
  };
  return { dependencies, repository, rows, sent };
}

describe('public leads API', () => {
  it('keeps launch updates distinct from early-adopter applications', async () => {
    const context = createContext();
    const app = createPublicLeadsApp({
      dependencies: context.dependencies,
      rateLimiter: { consume: vi.fn(async () => undefined) },
      repository: context.repository,
    });
    const response = await app.request('/api/public-leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        consent: true,
        email: 'Reader@Example.com',
        locale: 'fr',
        purpose: 'LAUNCH_UPDATES',
      }),
    });
    expect(response.status).toBe(202);
    expect(context.repository.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'reader@example.com',
        motivation: undefined,
        purpose: 'LAUNCH_UPDATES',
      }),
    );
    expect(context.sent).toEqual([
      { email: 'reader@example.com', purpose: 'LAUNCH_UPDATES' },
    ]);
  });

  it('requires consent and motivation for early adopters', async () => {
    const context = createContext();
    const app = createPublicLeadsApp({ dependencies: context.dependencies });
    const response = await app.request('/api/public-leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        consent: true,
        email: 'candidate@example.com',
        locale: 'en',
        purpose: 'EARLY_ADOPTER',
      }),
    });
    expect(response.status).toBe(400);
  });

  it.each(['confirm', 'unsubscribe', 'delete'] as const)(
    'applies the %s action through a hashed token',
    async (action) => {
      const context = createContext();
      const app = createPublicLeadsApp({ repository: context.repository });
      const response = await app.request(`/api/public-leads/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: 'public-management-token-that-is-long-enough',
        }),
      });
      expect(response.status).toBe(200);
      expect(context.repository[action]).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.any(Date),
      );
    },
  );

  it('exports a bounded CSV only through an authenticated admin', async () => {
    const context = createContext();
    const app = createPublicLeadsApp({
      authentication: async (requestContext, next) => {
        requestContext.set('user', {
          displayName: 'Admin',
          email: 'admin@example.com',
          id: '00000000-0000-4000-8000-000000000002',
          locale: 'fr',
          role: 'ADMIN',
        });
        await next();
      },
      repository: context.repository,
    });
    const response = await app.request(
      '/api/admin/public-leads/export?limit=10&purpose=LAUNCH_UPDATES',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(await response.text()).toContain('reader@example.com');
    expect(context.rows).toEqual([{ limit: 10, purpose: 'LAUNCH_UPDATES' }]);
  });

  it('returns two truthful metrics and one row per normalized contact', async () => {
    const context = createContext();
    const app = createPublicLeadsApp({
      authentication: async (requestContext, next) => {
        requestContext.set('user', {
          displayName: 'Admin',
          email: 'admin@example.com',
          id: '00000000-0000-4000-8000-000000000002',
          locale: 'fr',
          role: 'ADMIN',
        });
        await next();
      },
      repository: context.repository,
    });
    const response = await app.request(
      '/api/admin/public-leads?limit=25&offset=0&search=reader',
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      page: {
        earlyAdopterApplications: number;
        items: unknown[];
        launchUpdatesConfirmed: number;
        total: number;
      };
    };
    expect(body.page).toMatchObject({
      earlyAdopterApplications: 1,
      launchUpdatesConfirmed: 1,
      total: 1,
    });
    expect(body.page.items).toHaveLength(1);
    expect(context.repository.list).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      search: 'reader',
    });
  });

  it('refuses the contact directory to a non-admin account', async () => {
    const context = createContext();
    const app = createPublicLeadsApp({
      authentication: async (requestContext, next) => {
        requestContext.set('user', {
          displayName: 'Learner',
          email: 'learner@example.com',
          id: '00000000-0000-4000-8000-000000000005',
          locale: 'fr',
          role: 'USER',
        });
        await next();
      },
      repository: context.repository,
    });

    const response = await app.request('/api/admin/public-leads');
    expect(response.status).toBe(403);
    expect(context.repository.list).not.toHaveBeenCalled();
  });

  it('requires an explicit admin transition before the invitation workflow', async () => {
    const context = createContext();
    const app = createPublicLeadsApp({
      authentication: async (requestContext, next) => {
        requestContext.set('user', {
          displayName: 'Admin',
          email: 'admin@example.com',
          id: '00000000-0000-4000-8000-000000000002',
          locale: 'fr',
          role: 'ADMIN',
        });
        await next();
      },
      repository: context.repository,
    });
    const response = await app.request(
      '/api/admin/public-leads/00000000-0000-4000-8000-000000000004/convert-to-access-request',
      { method: 'POST' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      nextAction: 'REVIEW_AND_INVITE',
      requestId: '00000000-0000-4000-8000-000000000003',
    });
  });
});
