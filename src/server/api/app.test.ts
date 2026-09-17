import { apiApp } from './app';

describe('consolidated Vercel API', () => {
  it('exposes the authentication routes through the single entry point', async () => {
    const response = await apiApp.request('/api/auth/session');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ user: null });
  });

  it('answers 404 for a path the API does not serve (V4.5-187)', async () => {
    // This assertion read 401 until V4.5-187, and that 401 was not a decision.
    // Thirteen apps guarded `*`, so a wildcard `requireUser` matched any path
    // at all — including paths no route serves — and answered before the router
    // could conclude there was nothing there. The same leak closed the landing
    // funnel for its entire life (V4.5-186); this test was pinning the other
    // face of it.
    //
    // With the guards scoped to the routes their apps actually serve, an
    // unserved path reaches the end of the router and 404 is the truthful
    // answer. The change is deliberate and it is a real one: an anonymous
    // caller can now tell "exists but needs a session" from "does not exist".
    // That distinction was worth nothing here — the client bundle is public and
    // already names every endpoint it calls, so a blanket 401 hid the API's
    // shape from nobody while making it lie to authenticated callers who
    // mistyped a path.
    const response = await apiApp.request('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('routes publiques à travers l’application assemblée (V4.5-186)', () => {
  it('laisse la capture de contacts publics répondre sans session', async () => {
    // The landing funnel's only endpoint. A visitor has no account by
    // definition, so a 401 here is the funnel closed. It answered 401 in
    // production from the day it shipped, because a wildcard `requireUser`
    // from an app mounted earlier reached every route mounted after it.
    //
    // The assertion is "not 401", deliberately. What the endpoint answers
    // instead depends on configuration — 400 for a bad body where e-mail is
    // configured, 503 where it is not, as in this test environment. Pinning a
    // concrete code would tie this test to unrelated settings and hide the one
    // property that matters: it is reached without a session.
    const response = await apiApp.request('/api/public-leads', {
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).not.toBe(401);
    await expect(response.json()).resolves.not.toMatchObject({
      error: { code: 'AUTHENTICATION_REQUIRED' },
    });
  });

  it('laisse le webhook de paiement répondre sans session', async () => {
    // Stripe cannot authenticate: its signature is the authentication. A 401
    // here means no purchase is ever fulfilled.
    const response = await apiApp.request('/api/payments/webhook', {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).not.toBe(401);
  });

  it('n’a pas ouvert les routes qui exigent une session', async () => {
    // The fix is an ordering change; it must not have made anything public
    // that was not.
    const response = await apiApp.request('/api/today');
    expect(response.status).toBe(401);
  });

  it('laisse la session d’authentification inchangée', async () => {
    const response = await apiApp.request('/api/auth/session');
    expect(response.status).toBe(200);
  });
});
