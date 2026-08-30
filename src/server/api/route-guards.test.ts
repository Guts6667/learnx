import { accessRequestsApp } from './access-requests/app';
import { adminApp } from './admin/app';
import { aiPricingApp } from './ai-pricing/app';
import { apiApp } from './app';
import { authApp } from './auth/app';
import { catalogApp } from './catalog/app';
import { conceptAssessmentsApp } from './concept-assessments/app';
import { conceptsApp } from './concepts/app';
import { correctionsApp } from './corrections/app';
import { creditsApp } from './credits/app';
import { exercisesApp } from './exercises/app';
import { moduleRunsApp } from './module-runs/app';
import { notesApp } from './notes/app';
import { paymentsApp } from './payments/app';
import { curriculumApp } from './programs/app';
import { progressApp } from './progress/app';
import { publicLeadsApp } from './public-leads/app';
import { quizzesApp } from './quizzes/app';
import { reviewsApp } from './reviews/app';
import { stageAssessmentsApp } from './stage-assessments/app';
import { todayApp } from './today/app';

/**
 * V4.5-187. The safety net for route authentication.
 *
 * V4.5-186 was not a bug in any one app. `publicLeadsApp` was correct in
 * isolation and its unit tests passed throughout; it was unreachable only once
 * composed, because an app mounted earlier guards every route mounted after it
 * with `app.use('*', requireUser)`. Nothing in the suite looked at the composed
 * application, so the landing funnel answered 401 in production from the day it
 * shipped — 10 August 2026 — without a single test going red.
 *
 * These tests look at the composed application and nowhere else. They enumerate
 * every route the API actually declares and send a real unauthenticated request
 * to each one, which is the only vantage point from which either failure is
 * visible:
 *
 *   - a route that must be public answering 401 (V4.5-186);
 *   - a route that must be private answering anything else (the risk V4.5-187
 *     itself introduces, since scoping a guard too narrowly makes a route
 *     public and no existing test would notice).
 *
 * Both directions are asserted, because fixing the first while leaving the
 * second unwatched is how an availability incident becomes a security one.
 */

/**
 * Every route reachable without a session, with the reason it must be.
 *
 * This list is exhaustive and closed: a route absent from it must answer 401,
 * and an entry naming a route the API no longer declares is a failure rather
 * than dead weight, so the list cannot rot into a rubber stamp.
 */
const PUBLIC_ROUTES = [
  {
    path: '/api/health',
    method: 'GET',
    why: 'Liveness probe. Whatever watches the API from outside has no session by definition, and a probe that requires one reports nothing at the moment it is most needed. It returns no host, role, count or driver message — only reachable or not.',
  },
  {
    path: '/api/auth/session',
    method: 'GET',
    why: 'Reports whether a session exists. Answering 401 would make "logged out" indistinguishable from "broken".',
  },
  {
    path: '/api/auth/login',
    method: 'POST',
    why: 'Creates the session. Requiring one is circular.',
  },
  {
    path: '/api/auth/register',
    method: 'POST',
    why: 'Creates the account. Requiring one is circular.',
  },
  {
    path: '/api/auth/logout',
    method: 'POST',
    why: 'Must succeed even from an expired session, or a stale cookie can never be cleared.',
  },
  {
    path: '/api/access-requests',
    method: 'POST',
    why: 'Asking for access is what someone without an account does.',
  },
  {
    path: '/api/access-requests/verify-email',
    method: 'POST',
    why: 'Follows a mailed link, before any account exists.',
  },
  {
    path: '/api/access-invitations/activate',
    method: 'POST',
    why: 'Turns an invitation into an account. Pre-account by definition.',
  },
  {
    path: '/api/public-leads',
    method: 'POST',
    why: 'The landing funnel. This is the route V4.5-186 was about.',
  },
  {
    path: '/api/public-leads/confirm',
    method: 'POST',
    why: 'Double opt-in from a mailed link.',
  },
  {
    path: '/api/public-leads/unsubscribe',
    method: 'POST',
    why: 'Unsubscribing must never require an account — the recipient may not have one.',
  },
  {
    path: '/api/public-leads/delete',
    method: 'POST',
    why: 'Erasure request from a mailed link. A GDPR obligation that cannot be gated on a session.',
  },
  {
    path: '/api/payments/webhook',
    method: 'POST',
    why: 'Stripe cannot hold a session. The signature is the authentication, verified inside the handler.',
  },
] as const;

type DeclaredRoute = { method: string; path: string };

/**
 * Every sub-app mounted into the API, so each can be questioned on its own.
 *
 * Asking the composed application is not enough, and V4.5-187 is the reason.
 * Today thirteen apps guard `*`, so every route is protected several times over
 * by apps that have nothing to do with it — which means the composed
 * application answers 401 even for a route whose own app guards nothing. Remove
 * one app's guard and the suite stays green, masked by its neighbours. That is
 * the same blindness as V4.5-186, pointed the other way.
 *
 * Scoping the guards removes the masking, and removing the masking is exactly
 * what makes a too-narrow prefix dangerous. So each app is also asked in
 * isolation, where nothing can answer on its behalf.
 */
const MOUNTED_APPS = [
  ['auth', authApp],
  ['access-requests', accessRequestsApp],
  ['admin', adminApp],
  ['ai-pricing', aiPricingApp],
  ['public-leads', publicLeadsApp],
  ['payments', paymentsApp],
  ['corrections', correctionsApp],
  ['catalog', catalogApp],
  ['programs', curriculumApp],
  ['progress', progressApp],
  ['concepts', conceptsApp],
  ['concept-assessments', conceptAssessmentsApp],
  ['credits', creditsApp],
  ['quizzes', quizzesApp],
  ['exercises', exercisesApp],
  ['module-runs', moduleRunsApp],
  ['stage-assessments', stageAssessmentsApp],
  ['notes', notesApp],
  ['reviews', reviewsApp],
  ['today', todayApp],
] as const satisfies readonly (readonly [
  string,
  { routes: DeclaredRoute[] },
])[];

function ownRoutes(app: { routes: DeclaredRoute[] }): DeclaredRoute[] {
  const routes = app.routes;
  const seen = new Set<string>();

  return routes
    .filter((route) => route.method !== 'ALL')
    .filter((route) => {
      const key = `${route.method} ${route.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function declaredRoutes(): DeclaredRoute[] {
  return ownRoutes(apiApp as unknown as { routes: DeclaredRoute[] });
}

/** Path parameters are substituted so the request reaches the router at all. */
function probePath(path: string): string {
  return path.replace(/:[A-Za-z0-9_]+/g, 'route-guards-probe');
}

async function requestWithoutSession(
  route: DeclaredRoute,
  app: { request: typeof apiApp.request } = apiApp,
): Promise<Response> {
  const carriesBody =
    route.method === 'POST' ||
    route.method === 'PUT' ||
    route.method === 'PATCH';

  return app.request(probePath(route.path), {
    method: route.method,
    ...(carriesBody
      ? { body: '{}', headers: { 'content-type': 'application/json' } }
      : {}),
  });
}

function isPublic(route: DeclaredRoute): boolean {
  return PUBLIC_ROUTES.some(
    (entry) => entry.method === route.method && entry.path === route.path,
  );
}

describe('authentification des routes à travers l’application assemblée (V4.5-187)', () => {
  it('déclare des routes — sans quoi tout le reste passerait à vide', () => {
    // Every assertion below iterates the declared routes. An empty enumeration
    // would make the whole file vacuously green, which is the one way a safety
    // net fails silently.
    expect(declaredRoutes().length).toBeGreaterThan(80);
  });

  it('refuse toute route non publique à un visiteur sans session', async () => {
    const reachable: string[] = [];

    for (const route of declaredRoutes()) {
      if (isPublic(route)) continue;

      const response = await requestWithoutSession(route);
      if (response.status !== 401) {
        reachable.push(`${response.status} ${route.method} ${route.path}`);
      }
    }

    // Named in the failure so the diff says which route opened, not just that
    // the count changed.
    expect(reachable).toEqual([]);
  }, 120_000);

  it('laisse joignable chaque route publique déclarée', async () => {
    const blocked: string[] = [];

    for (const entry of PUBLIC_ROUTES) {
      const response = await requestWithoutSession(entry);
      if (response.status === 401) {
        blocked.push(`${entry.method} ${entry.path} — ${entry.why}`);
      }
    }

    // This is V4.5-186 as a test. It fails on the mount order that shipped.
    expect(blocked).toEqual([]);
  }, 120_000);

  it('ne garde aucune entrée publique pour une route qui n’existe plus', () => {
    const declared = new Set(
      declaredRoutes().map((route) => `${route.method} ${route.path}`),
    );

    const stale = PUBLIC_ROUTES.filter(
      (entry) => !declared.has(`${entry.method} ${entry.path}`),
    ).map((entry) => `${entry.method} ${entry.path}`);

    // A stale entry is an exemption nobody is checking any more.
    expect(stale).toEqual([]);
  });

  it('garde chaque application par elle-même, sans compter sur ses voisines', async () => {
    const unguarded: string[] = [];

    for (const [name, app] of MOUNTED_APPS) {
      for (const route of ownRoutes(app)) {
        if (isPublic(route)) continue;

        const response = await requestWithoutSession(
          route,
          app as unknown as { request: typeof apiApp.request },
        );
        if (response.status !== 401) {
          unguarded.push(
            `${name}: ${response.status} ${route.method} ${route.path}`,
          );
        }
      }
    }

    // Mount order cannot influence this one, and neither can another app's
    // guard. It is the assertion that makes scoping the wildcards safe to do.
    expect(unguarded).toEqual([]);
  }, 120_000);

  it('ne laisse aucune application garder `*`', () => {
    const wildcards = MOUNTED_APPS.flatMap(([name, app]) =>
      app.routes
        .filter((route) => route.method === 'ALL')
        .filter((route) => route.path === '*' || route.path === '/*')
        .map(() => name),
    );

    // A wildcard guard runs for every request reaching the app, not only for
    // the paths it serves, so it authenticates everything mounted after it.
    // That is what closed the landing funnel for its entire life.
    expect([...new Set(wildcards)]).toEqual([]);
  });
});
