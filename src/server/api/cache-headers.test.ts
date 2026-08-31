import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma.js', () => ({
  prisma: {
    creditPack: { findMany: async () => [] },
    paymentOrder: { findMany: async () => [] },
  },
}));

/**
 * The API-wide `Cache-Control` is a default, not a decree.
 *
 * It runs after the handler, so setting it unconditionally silently unmade any
 * route that had decided for itself — and one had. Nothing tested the header a
 * route actually serves, only the header the code asks for, which is how a
 * five-minute shared cache could be designed, reviewed, merged and never exist.
 */
describe('en-têtes de cache réellement servis', () => {
  it('laisse une route publique garder le cache qu’elle a choisi', async () => {
    const { apiApp } = await import('./app.js');

    const response = await apiApp.request('/api/public/credit-packs');

    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('refuse toute mise en cache partout ailleurs', async () => {
    // The default protects every authenticated response, and it must not need
    // to be remembered route by route.
    const { apiApp } = await import('./app.js');

    const response = await apiApp.request('/api/credits');

    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
