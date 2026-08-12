import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/I18nProvider';
import { LandingPage } from '@/pages/LandingPage';

const routeMock = vi.hoisted(() => vi.fn());
vi.mock('preact-router', () => ({ route: routeMock }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  routeMock.mockClear();
  window.history.replaceState({}, '', '/');
});

describe('LandingPage', () => {
  it('opens the learner application instead of the landing page in standalone mode', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(
      (query) =>
        ({
          matches: query === '(display-mode: standalone)',
          media: query,
        }) as MediaQueryList,
    ));

    const { container } = render(
      <I18nProvider locale="fr">
        <LandingPage />
      </I18nProvider>,
    );

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(routeMock).toHaveBeenCalledWith('/today', true));
  });

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
        name: 'Piloter un projet en équipe',
      }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('heading', { name: 'Formuler un objectif de sprint' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The Scrum Guide 2020/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/corrections assistées par IA sont prévues pour V4/i),
    ).toBeInTheDocument();
    const researchLink = screen.getByRole('link', {
      name: 'Lire le rapport de recherche',
    });
    expect(researchLink).toHaveAttribute('href', '/research/ai-correction/');
    expect(researchLink).toHaveAttribute('target', '_blank');
    expect(researchLink).toHaveAttribute('rel', 'noopener');
    expect(researchLink).toHaveClass('ui-action--md');
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
  });

  it('localizes the complete product preview in English', () => {
    render(
      <I18nProvider locale="en">
        <LandingPage />
      </I18nProvider>,
    );

    expect(
      screen.getAllByRole('heading', { name: 'Leading a team project' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('heading', { name: 'Write a sprint goal' }),
    ).toBeInTheDocument();
    expect(screen.getByText('One useful objective')).toBeInTheDocument();
    expect(
      screen.getByText(/A sprint goal describes the outcome/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Piloter|Cadrer|Formuler|objectif unique/),
    ).not.toBeInTheDocument();
    const researchLink = screen.getByRole('link', {
      name: 'Read the research report',
    });
    expect(researchLink).toHaveAttribute(
      'href',
      '/research/ai-correction/en.html',
    );
    expect(researchLink).toHaveAttribute('target', '_blank');
    expect(researchLink).toHaveAttribute('rel', 'noopener');
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
