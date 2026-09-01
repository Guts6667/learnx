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
    purchasableByUser: vi.fn(async () => ({ entry: true })),
    listActivePacks: vi.fn(async () => [
      {
        credits: 100n,
        currency: 'EUR',
        key: 'starter',
        label: 'Découverte',
        labelEn: 'Starter',
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
      // The same derived figures as the authenticated route, from the same
      // source: the price seen before signing up is the price met after,
      // including the rate and the bonus (V4.5-212). No `purchasable` — there
      // is no account here to evaluate it against.
      correctionQuoteCredits: '30',
      correctionReservationCredits: '41',
      packs: [
        {
          approximateCorrections: '3',
          bonusCredits: '-1400',
          credits: '100',
          creditsPerEuro: '6',
          currency: 'EUR',
          key: 'starter',
          label: 'Découverte',
          labelEn: 'Starter',
          // Une propriété du palier, pas du visiteur : elle est la même dans
          // tous les corps mis en cache, et la condition lue avant l'accès est
          // celle rencontrée après (V4.5-213).
          oncePerAccount: false,
          recommended: false,
          priceMinor: '1500',
        },
      ],
    });
  });

  it('désigne le palier limité à un achat par compte', async () => {
    // La règle appartient au serveur : `ENTRY_TIER_PACK_KEY` la porte, le 409
    // l'applique, et la carte la lit. Un écran qui reconnaîtrait la clé
    // lui-même en serait un second dépositaire, et le jour d'un renommage les
    // deux ne diraient plus la même chose.
    const app = createPublicCatalogueApp({
      catalogue: {
        ...catalogue,
        listActivePacks: async () => [
          {
            credits: 300n,
            currency: 'EUR',
            key: 'entry',
            label: 'Premier pack',
            labelEn: 'First pack',
            priceMinor: 300n,
          },
        ],
      },
    });

    const response = await app.request('/api/public/credit-packs');
    const body = (await response.json()) as {
      packs: { oncePerAccount: boolean }[];
    };

    expect(body.packs[0].oncePerAccount).toBe(true);
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

    await expect(response.json()).resolves.toEqual({
      correctionQuoteCredits: '30',
      correctionReservationCredits: '41',
      packs: [],
    });
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
