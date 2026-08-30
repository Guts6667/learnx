import { createPublicCatalogueApp } from './app';

/**
 * The one route a stranger may read about money (V4.5-206).
 *
 * Two things are asserted rather than assumed: that it publishes only what an
 * owner has activated, and that it publishes nothing else. A price list is a
 * commitment; an identifier on it is a leak.
 */
describe('catalogue public', () => {
  const catalogue = {
    listActivePacks: vi.fn(async () => [
      {
        credits: 100n,
        currency: 'EUR',
        key: 'starter',
        label: 'Découverte',
        priceMinor: 1500n,
      },
    ]),
    listOwnOrders: vi.fn(async () => []),
  };

  it('publie les paliers actifs, montants en chaînes décimales', async () => {
    const app = createPublicCatalogueApp({ catalogue });

    const response = await app.request('/api/public/credit-packs');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      packs: [
        {
          credits: '100',
          currency: 'EUR',
          key: 'starter',
          label: 'Découverte',
          priceMinor: '1500',
        },
      ],
    });
  });

  it('lit le catalogue par le même lecteur que l’écran authentifié', async () => {
    // `listActivePacks` porte la règle « actif = achetable » (V4.5-161) : une
    // seconde requête avec son propre filtre serait un second endroit où
    // l'oublier, et l'oubli publierait un prix que personne n'a arbitré.
    const app = createPublicCatalogueApp({ catalogue });

    await app.request('/api/public/credit-packs');

    expect(catalogue.listActivePacks).toHaveBeenCalled();
  });

  it('ne rend aucun palier tant qu’aucun n’est activé', async () => {
    // C'est ce vide qui fait dire « bientôt » à la landing. Le commutateur est
    // la décision du propriétaire (V4.5-164), pas un drapeau dans le code.
    const app = createPublicCatalogueApp({
      catalogue: { ...catalogue, listActivePacks: async () => [] },
    });

    const response = await app.request('/api/public/credit-packs');

    await expect(response.json()).resolves.toEqual({ packs: [] });
  });

  it('ne divulgue aucun identifiant interne', async () => {
    const app = createPublicCatalogueApp({ catalogue });

    const body = await (await app.request('/api/public/credit-packs')).text();

    expect(body).not.toMatch(/\bid\b|position|provider|active|userId/iu);
  });

  it('se laisse mettre en cache, la même liste pour tout le monde', async () => {
    const app = createPublicCatalogueApp({ catalogue });

    const response = await app.request('/api/public/credit-packs');

    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });
});
