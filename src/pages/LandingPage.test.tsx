import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/I18nProvider';
import { LandingPage } from '@/pages/LandingPage';

afterEach(() => vi.restoreAllMocks());

describe('LandingPage', () => {
  it('presents the promise, two separate purposes and the login utility', () => {
    render(
      <I18nProvider locale="fr">
        <LandingPage />
      </I18nProvider>,
    );
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Un parcours, pas une bibliothèque.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Candidater comme early adopter').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Être informé du lancement').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Se connecter' })[0],
    ).toHaveAttribute('href', '/login');
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', {
        name: 'Fondamentaux de la psychologie',
      }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('heading', { name: 'Définir la psychologie' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Psychology 2e — 1\.1 What Is Psychology\?/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/corrections assistées par IA sont prévues pour V4/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
  });

  it('submits updates without creating an access request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(
      <I18nProvider locale="en">
        <LandingPage />
      </I18nProvider>,
    );
    const form = screen
      .getByRole('heading', { name: 'Follow the launch' })
      .closest('article');
    if (!form) throw new Error('Updates form missing.');
    const emailInput = form.querySelector('input[type="email"]');
    const consentInput = form.querySelector('input[type="checkbox"]');
    const interestForm = form.querySelector('form');
    if (!emailInput || !consentInput || !interestForm) {
      throw new Error('Updates form controls missing.');
    }
    fireEvent.input(emailInput, {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(consentInput);
    fireEvent.submit(interestForm);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [path, request] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/public-leads');
    expect(String(request?.body)).toContain('LAUNCH_UPDATES');
    expect(String(request?.body)).not.toContain('EARLY_ADOPTER');
    expect(
      await screen.findByText(
        'Check your inbox to confirm your launch updates subscription.',
      ),
    ).toBeInTheDocument();
  });
});
