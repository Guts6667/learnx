import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/I18nProvider';
import { PublicInterestPage } from '@/pages/PublicInterestPage';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('PublicInterestPage', () => {
  it('applique une action valide puis retire le secret de l’URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/interest#action=confirm&token=public-token',
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'confirmed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(
      <I18nProvider locale="fr">
        <PublicInterestPage />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Votre choix est enregistré',
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public-leads/confirm',
      expect.objectContaining({
        body: JSON.stringify({ token: 'public-token' }),
        method: 'POST',
      }),
    );
    expect(window.location.pathname).toBe('/interest');
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('refuse une action incomplète sans appel réseau et permet le retour', async () => {
    window.history.replaceState({}, '', '/interest#action=confirm');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <I18nProvider locale="fr">
        <PublicInterestPage />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Lien indisponible' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute(
      'href',
      '/',
    );
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
