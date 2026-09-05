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
  const pack = {
    approximateCorrections: '3',
    bonusCredits: '0',
    credits: '100',
    creditsPerEuro: '6',
    currency: 'EUR',
    key: 'starter',
    label: 'Découverte',
    labelEn: 'Starter',
    oncePerAccount: false,
    recommended: false,
    priceMinor: '1500',
  };
  const shared = {
    correctionQuoteCredits: '30',
    correctionReservationCredits: '41',
  };

  afterEach(() => vi.unstubAllGlobals());

  it('publie les paliers que le catalogue donne, et rien de plus', async () => {
    stub(() => Promise.resolve(jsonResponse({ ...shared, packs: [pack] })));

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
    stub(() => Promise.resolve(jsonResponse({ ...shared, packs: [] })));

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
        jsonResponse({ ...shared, packs: [{ ...pack, priceMinor: 1500 }] }),
      ),
    );

    renderSection();

    expect(
      await screen.findByText(/n’ont pas pu être chargés/u),
    ).toBeInTheDocument();
    expect(screen.queryByText('Découverte')).not.toBeInTheDocument();
  });

  it('mène à la candidature, seule porte d’entrée aujourd’hui', async () => {
    stub(() => Promise.resolve(jsonResponse({ ...shared, packs: [] })));

    renderSection();

    expect(
      await screen.findByRole('link', { name: 'Demander un accès' }),
    ).toHaveAttribute('href', '#early-adopter');
  });
  it('dit la même chose que l’écran d’achat, sans bouton d’achat', async () => {
    // Un visiteur anonyme ne peut pas acheter : l'action de la section reste
    // la demande d'accès, une fois, à côté du titre. Les chiffres, eux, sont
    // les mêmes qu'après inscription — ils viennent de la même source.
    stub(() =>
      Promise.resolve(
        jsonResponse({
          ...shared,
          packs: [
            {
              ...pack,
              approximateCorrections: '29',
              bonusCredits: '80',
              creditsPerEuro: '110',
              key: 'entry',
              label: 'Premier pack',
              labelEn: 'First pack',
              oncePerAccount: true,
              recommended: false,
            },
          ],
        }),
      ),
    );

    renderSection();

    expect(await screen.findByText('110 crédits par euro')).toBeInTheDocument();
    expect(screen.getByText('environ 29 corrections')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Un seul achat par compte : à ce montant, les frais fixes du paiement absorbent une part disproportionnée. Un remboursement ne rouvre pas ce droit.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Une correction est devisée à 30 crédits et en réserve 41 ; ce qui n’est pas utilisé vous est rendu aussitôt.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Acheter/u })).toBeNull();
  });

  it('rend le libellé anglais à un visiteur anglophone', async () => {
    // Avant `labelEn`, cette section affichait « Premier pack » en anglais :
    // le corps est mis en cache pour tout le monde, donc c'est l'écran qui
    // choisit la langue (V4.5-212).
    stub(() => Promise.resolve(jsonResponse({ ...shared, packs: [pack] })));

    renderSection('en');

    expect(
      await screen.findByRole('heading', { name: 'Starter' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Découverte')).not.toBeInTheDocument();
  });

  it('refuse une réponse privée des chiffres partagés', async () => {
    // Le devis et la réserve ne sont pas décoratifs : sans eux la carte
    // annoncerait une capacité approximative sans dire pourquoi elle l'est.
    // Une réponse incomplète est un état visible, pas une carte amputée.
    stub(() => Promise.resolve(jsonResponse({ packs: [pack] })));

    renderSection();

    expect(
      await screen.findByText(/n’ont pas pu être chargés/u),
    ).toBeInTheDocument();
    expect(screen.queryByText('Découverte')).not.toBeInTheDocument();
  });
});
