import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/I18nProvider';
import { LandingPage } from '@/pages/LandingPage';

const routeMock = vi.hoisted(() => vi.fn());
vi.mock('@/app/navigation', () => ({ navigate: routeMock }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

/**
 * La page lit le catalogue public au montage (V4.5-206). Les tests ci-dessous
 * ne portent pas sur lui : il répond un catalogue vide, et chacun n'observe
 * que les appels de la route qui l'intéresse. Sans ce routage par chemin, la
 * première réponse d'un test de formulaire irait au catalogue.
 */
function stubFetch(
  handler: (path: string, init?: RequestInit) => Promise<Response>,
) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(((path: string, init?: RequestInit) =>
      String(path) === '/api/public/credit-packs'
        ? Promise.resolve(jsonResponse({ packs: [] }))
        : handler(String(path), init)) as typeof globalThis.fetch);
}

beforeEach(() => {
  stubFetch(() => Promise.resolve(jsonResponse({ message: 'ok' }, 202)));
});

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
    // The hero secondary scrolls to the product; it never competes with the
    // single primary CTA.
    const howItWorks = screen.getByRole('link', {
      name: 'Voir comment ça marche',
    });
    expect(howItWorks).toHaveAttribute('href', '#product');
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
        name: 'Retour immédiat sur vos écrits',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Correction élargie, puis parcours conçus par IA',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pilote en cours')).toBeInTheDocument();
    // One primary CTA, repeated in nav, hero and the application form.
    expect(
      screen.getAllByRole('link', { name: 'Candidater' }),
    ).not.toHaveLength(0);
    const researchLink = screen.getByRole('link', {
      name: 'Lire le verdict complet',
    });
    expect(researchLink).toHaveAttribute(
      'href',
      '/research/ai-correction/index.html',
    );
    expect(researchLink).not.toHaveAttribute('target');
    expect(researchLink).toHaveClass('landing-research-action');
    expect(screen.getByText(/sept faux PASS/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir comment ça marche' }),
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
      name: 'Read the full verdict',
    });
    expect(researchLink).toHaveAttribute(
      'href',
      '/research/ai-correction/en.html',
    );
    expect(researchLink).not.toHaveAttribute('target');
  });

  it('submits updates without creating an access request', async () => {
    const fetchMock = stubFetch(() =>
      Promise.resolve(jsonResponse({ message: 'ok' }, 202)),
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
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) => path === '/api/public-leads'),
      ).toBe(true),
    );
    const [path, request] =
      fetchMock.mock.calls.find(([call]) => call === '/api/public-leads') ?? [];
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
    let leadAttempts = 0;
    stubFetch(() => {
      leadAttempts += 1;
      return leadAttempts === 1
        ? Promise.reject(new TypeError('Network unavailable'))
        : Promise.resolve(jsonResponse({ message: 'ok' }, 202));
    });
    render(
      <I18nProvider locale="fr">
        <LandingPage />
      </I18nProvider>,
    );
    const article = screen
      .getByRole('heading', {
        name: 'Participez aux premiers usages réels',
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
    expect(leadAttempts).toBe(2);
  });
});
