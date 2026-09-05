import { describe, expect, it, vi } from 'vitest';

import { createPublicLeadsApp } from './app';
import type {
  PublicLeadRepository,
  PublicLeadServiceDependencies,
} from './service';

function createContext() {
  let tokenSequence = 0;
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
          firstName: null,
          friction: null,
          id: '00000000-0000-4000-8000-000000000004',
          locale: 'fr',
          motivation: null,
          purpose: 'LAUNCH_UPDATES',
          status: 'CONFIRMED',
        },
      ] satisfies Awaited<ReturnType<PublicLeadRepository['export']>>;
    }),
    issue: vi.fn(async () => 'lead-id'),
    list: vi.fn(
      async () =>
        ({
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
                  firstName: null,
                  friction: null,
                  locale: 'fr',
                  motivation: null,
                  purpose: 'LAUNCH_UPDATES',
                  status: 'CONFIRMED',
                },
                {
                  confirmedAt: null,
                  createdAt: new Date('2026-08-10T09:30:00Z'),
                  firstName: 'Maya',
                  friction: 'Je manque de temps en semaine.',
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
        }) satisfies Awaited<ReturnType<PublicLeadRepository['list']>>,
    ),
    unsubscribe: vi.fn(async () => true),
  };
  const sent: Array<{ email: string; purpose: string }> = [];
  const dependencies: PublicLeadServiceDependencies = {
    appUrl: 'https://learn-x.app',
    createId: () => '00000000-0000-4000-8000-000000000001',
    // Un jeton distinct par appel : une soumission qui abonne aussi en
    // demande quatre, et un harnais qui n'en sert que deux ferait échouer
    // l'abonnement pour une raison qui n'existe qu'ici (V4.5-228).
    createToken: vi
      .fn()
      .mockImplementation(() => `token-that-is-long-enough-${tokenSequence++}`),
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

  it('enregistre la candidature et l’abonnement en une seule requête', async () => {
    // V4.5-228. Une soumission du formulaire = un appel. Deux appels
    // laisseraient la personne candidate sans être abonnée quand le second
    // échoue, et lui enverraient deux courriels pour un seul geste.
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
        email: 'Maya@Example.com',
        firstName: 'Maya',
        friction: 'Je manque de temps en semaine.',
        launchUpdates: true,
        locale: 'fr',
        motivation: 'Je veux apprendre à cadrer un sprint correctement.',
        purpose: 'EARLY_ADOPTER',
      }),
    });

    expect(response.status).toBe(202);
    // Deux lignes — la contrainte d'unicité est (contact, motif) — écrites par
    // le même appel.
    expect(context.repository.issue).toHaveBeenCalledTimes(2);
    expect(context.repository.issue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        email: 'maya@example.com',
        firstName: 'Maya',
        friction: 'Je manque de temps en semaine.',
        purpose: 'EARLY_ADOPTER',
      }),
    );
    // L'abonnement ne porte pas le frein : c'est une question de candidature.
    // Le champ est ABSENT, pas présent à `undefined` — la minimisation se lit
    // dans ce qui n'est pas écrit.
    const subscription = vi.mocked(context.repository.issue).mock
      .calls[1]?.[0] as unknown as Record<string, unknown>;
    expect(subscription).toMatchObject({
      email: 'maya@example.com',
      firstName: 'Maya',
      purpose: 'LAUNCH_UPDATES',
    });
    expect('friction' in subscription).toBe(false);
    expect('motivation' in subscription).toBe(false);
    // Un seul courriel : deux donneraient à lire deux inscriptions.
    expect(context.sent).toEqual([
      { email: 'maya@example.com', purpose: 'EARLY_ADOPTER' },
    ]);
  });

  it('n’abonne pas quand la case est laissée décochée', async () => {
    // La case est décochée par défaut dans la maquette, et le défaut est la
    // décision : rien ne s'ajoute sans un geste.
    const context = createContext();
    const app = createPublicLeadsApp({
      dependencies: context.dependencies,
      rateLimiter: { consume: vi.fn(async () => undefined) },
      repository: context.repository,
    });

    await app.request('/api/public-leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        consent: true,
        email: 'solo@example.com',
        firstName: 'Sol',
        locale: 'fr',
        motivation: 'Je veux apprendre à cadrer un sprint correctement.',
        purpose: 'EARLY_ADOPTER',
      }),
    });

    expect(context.repository.issue).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'friction sur un abonnement',
      {
        friction: 'Trop de réunions.',
        purpose: 'LAUNCH_UPDATES',
      },
    ],
    [
      'launchUpdates sur un abonnement',
      {
        launchUpdates: true,
        purpose: 'LAUNCH_UPDATES',
      },
    ],
    [
      'prénom vide',
      { firstName: '   ', motivation: 'Je veux apprendre à cadrer.' },
    ],
  ])('refuse : %s', async (_label, overrides) => {
    // Refusés plutôt qu'ignorés : accepter en silence laisserait croire qu'un
    // enregistrement a eu lieu.
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
        email: 'refused@example.com',
        firstName: 'Maya',
        locale: 'fr',
        purpose: 'EARLY_ADOPTER',
        ...overrides,
      }),
    });

    expect(response.status).toBe(400);
    expect(context.repository.issue).not.toHaveBeenCalled();
  });

  it('refuse une candidature sans prénom', async () => {
    // Le prénom sert à saluer la personne dans les courriels ; une
    // candidature sans lui produirait un courriel impersonnel qu'on ne
    // pourrait plus corriger après coup.
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
        email: 'noname@example.com',
        locale: 'fr',
        motivation: 'Je veux apprendre à cadrer un sprint correctement.',
        purpose: 'EARLY_ADOPTER',
      }),
    });

    expect(response.status).toBe(400);
    expect(context.repository.issue).not.toHaveBeenCalled();
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
