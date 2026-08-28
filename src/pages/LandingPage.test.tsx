import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/I18nProvider';
import { LandingPage } from '@/pages/LandingPage';

const routeMock = vi.hoisted(() => vi.fn());
vi.mock('@/app/navigation', () => ({ navigate: routeMock }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  routeMock.mockClear();
  window.history.replaceState({}, '', '/');
});

describe('LandingPage', () => {
  it('opens the learner application instead of the landing page in standalone mode', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(
        (query) =>
          ({
            matches: query === '(display-mode: standalone)',
            media: query,
          }) as MediaQueryList,
      ),
    );

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
        name: 'Votre chemin vers la connaissance.',
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
      screen.getAllByRole('navigation', { name: 'Navigation publique' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('region', {
        name: 'Aperçu réaliste du programme Piloter un projet en équipe',
      }),
    ).toHaveTextContent('Activité 7 sur 17');
    expect(
      screen.getAllByRole('heading', {
        name: 'Formuler un objectif de sprint',
      }),
    ).toHaveLength(2);
    expect(screen.getByText(/The Scrum Guide 2020/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Correction formative assistée par IA',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Création guidée de programmes par IA',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pilote actuel')).toBeInTheDocument();
    const researchLink = screen.getByRole('link', {
      name: 'Explorer le journal de recherche',
    });
    expect(researchLink).toHaveAttribute(
      'href',
      '/research/ai-correction/index.html',
    );
    expect(researchLink).not.toHaveAttribute('target');
    expect(researchLink).toHaveClass('landing-research-action');
    expect(
      screen.getByText(/7 faux PASS et un écart ordinal de deux niveaux/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Être informé du lancement' }),
    ).not.toHaveClass('ui-action--secondary');
    expect(document.querySelector('.landing-brand img')).toHaveAttribute(
      'src',
      '/learnx-mark-on-paper.svg',
    );
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(
      screen.getByRole('link', { name: 'Aller au contenu principal' }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(
      screen.getByRole('textbox', {
        name: 'Comment souhaitez-vous utiliser LearnX ?',
      }),
    ).toHaveAttribute('maxlength', '2000');
  });

  it('localizes the complete product preview in English', () => {
    render(
      <I18nProvider locale="en">
        <LandingPage />
      </I18nProvider>,
    );

    expect(
      screen.getByRole('region', {
        name: 'Realistic preview of the Leading a team project programme',
      }),
    ).toHaveTextContent('Activity 7 of 17');
    expect(document.title).toBe('LearnX — Your path to knowledge');
    expect(
      screen.getAllByRole('heading', { name: 'Write a sprint goal' }),
    ).toHaveLength(2);
    expect(screen.getByText('One useful objective')).toBeInTheDocument();
    expect(
      screen.getByText(/A sprint goal describes the outcome/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Piloter|Cadrer|Formuler|objectif unique/),
    ).not.toBeInTheDocument();
    const researchLink = screen.getByRole('link', {
      name: 'Explore the research journal',
    });
    expect(researchLink).toHaveAttribute(
      'href',
      '/research/ai-correction/en.html',
    );
    expect(researchLink).not.toHaveAttribute('target');
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

  it('conserve une candidature après une erreur et permet une reprise explicite', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'ok' }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );
    render(
      <I18nProvider locale="fr">
        <LandingPage />
      </I18nProvider>,
    );
    const article = screen
      .getByRole('heading', {
        name: 'Participer aux premiers retours terrain',
      })
      .closest('article');
    if (!article) throw new Error('Early adopter form missing.');
    const email = article.querySelector<HTMLInputElement>(
      'input[type="email"]',
    );
    const consent = article.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const motivation = article.querySelector<HTMLTextAreaElement>('textarea');
    const form = article.querySelector('form');
    if (!email || !consent || !motivation || !form) {
      throw new Error('Early adopter controls missing.');
    }

    fireEvent.input(email, { target: { value: 'candidate@example.com' } });
    fireEvent.input(motivation, {
      target: { value: 'Je veux tester LearnX sur un parcours professionnel.' },
    });
    fireEvent.click(consent);
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Réessayez/);
    expect(email).toHaveValue('candidate@example.com');
    expect(motivation).toHaveValue(
      'Je veux tester LearnX sur un parcours professionnel.',
    );
    expect(consent).toBeChecked();

    fireEvent.submit(form);
    expect(
      await screen.findByText(/confirmer votre candidature early adopter/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
