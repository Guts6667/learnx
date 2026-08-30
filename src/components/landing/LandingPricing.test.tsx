import { render, screen } from '@testing-library/react';

import { LandingPricing } from '@/components/landing/LandingPricing';
import { I18nProvider } from '@/i18n/I18nProvider';

/**
 * La section tarifs de la page publique (V4.5-206).
 *
 * Ce qui est éprouvé ici n'est pas la mise en page mais la règle : jamais un
 * prix que le catalogue n'a pas donné, et jamais « bientôt » quand la vraie
 * réponse est « nous n'avons pas su lire ».
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function stub(response: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      expect(path).toBe('/api/public/credit-packs');
      return response();
    }),
  );
}

function renderSection(locale: 'en' | 'fr' = 'fr') {
  render(
    <I18nProvider locale={locale}>
      <LandingPricing />
    </I18nProvider>,
  );
}

describe('LandingPricing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('publie les paliers que le catalogue donne, et rien de plus', async () => {
    stub(() =>
      Promise.resolve(
        jsonResponse({
          packs: [
            {
              credits: '100',
              currency: 'EUR',
              key: 'starter',
              label: 'Découverte',
              priceMinor: '1500',
            },
          ],
        }),
      ),
    );

    renderSection();

    expect(
      await screen.findByRole('heading', { name: 'Découverte' }),
    ).toBeInTheDocument();
    expect(screen.getByText('100 crédits')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.replace(/\s/gu, '') === '15,00€'),
    ).toBeInTheDocument();
  });

  it('dit « bientôt » quand aucun palier n’est activé', async () => {
    // Un palier est inactif jusqu'à une décision du propriétaire (V4.5-161,
    // V4.5-164) : un catalogue actif vide est la façon dont le produit dit
    // qu'il n'y a pas encore de prix. Aucun tarif d'attente n'est inventé.
    stub(() => Promise.resolve(jsonResponse({ packs: [] })));

    renderSection();

    expect(
      await screen.findByText(/Les paliers ne sont pas encore ouverts/u),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('ne confond pas une lecture ratée avec un produit sans prix', async () => {
    stub(() =>
      Promise.resolve(
        jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500),
      ),
    );

    renderSection();

    expect(
      await screen.findByText(/n’ont pas pu être chargés/u),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pas encore ouverts/u)).not.toBeInTheDocument();
  });

  it('refuse une réponse hors contrat plutôt que d’afficher un prix douteux', async () => {
    // Un prix arrivé en nombre est un prix qui a déjà traversé un flottant.
    stub(() =>
      Promise.resolve(
        jsonResponse({
          packs: [
            {
              credits: '100',
              currency: 'EUR',
              key: 'starter',
              label: 'Découverte',
              priceMinor: 1500,
            },
          ],
        }),
      ),
    );

    renderSection();

    expect(
      await screen.findByText(/n’ont pas pu être chargés/u),
    ).toBeInTheDocument();
    expect(screen.queryByText('Découverte')).not.toBeInTheDocument();
  });

  it('mène à la candidature, seule porte d’entrée aujourd’hui', async () => {
    stub(() => Promise.resolve(jsonResponse({ packs: [] })));

    renderSection();

    expect(
      await screen.findByRole('link', { name: 'Demander un accès' }),
    ).toHaveAttribute('href', '#early-adopter');
  });
});
