import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { App } from '@/app/App';

describe('App', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'fr-FR',
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  function mockSession(user: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ user }))),
    );
  }

  it('affiche la landing sans requête privée ni navigation applicative', () => {
    window.history.pushState({}, '', '/');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Un parcours, pas une bibliothèque.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ouvre la connexion depuis une ancienne installation PWA sans session", async () => {
    window.history.pushState({}, '', '/');
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
      })),
    );
    mockSession(null);

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(
      screen.getByRole('link', { name: 'Demander un accès' }),
    ).toHaveAttribute('href', '/request-access');
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument();
  });

  it('redirige une route privée vers la connexion sans session', async () => {
    window.history.pushState({}, '', '/today');
    mockSession(null);

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument();
  });

  it('affiche un état de chargement pendant la vérification de session', () => {
    window.history.pushState({}, '', '/today');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    render(<App />);

    expect(
      screen.getByRole('status', { name: 'Vérification de la session' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Navigation principale' }),
    ).not.toBeInTheDocument();
  });

  it('affiche un état neutre hors ligne sans rediriger vers la connexion', () => {
    window.history.pushState({}, '', '/today');
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Network unavailable'))),
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mode hors ligne' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Connexion' }),
    ).not.toBeInTheDocument();
  });

  it('conserve la destination et revérifie la session après reconnexion', async () => {
    window.history.pushState({}, '', '/today');
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          user: {
            id: 'user-1',
            email: 'learner@example.com',
            displayName: 'Learner',
            role: 'USER',
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mode hors ligne' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    fireEvent(window, new Event('online'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('propose une relance explicite après un échec réseau en ligne', async () => {
    window.history.pushState({}, '', '/today');
    const user = {
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'USER',
    };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValue(jsonResponse({ user }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Connexion impossible',
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('désactive la connexion tant que le navigateur est hors ligne', async () => {
    window.history.pushState({}, '', '/login');
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled();
    expect(
      screen.getByText(/Reconnectez-vous pour vérifier votre session/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ouvre une demande d’accès publique sans demander de mot de passe', async () => {
    window.history.pushState({}, '', '/login');
    mockSession(null);

    render(<App />);

    const accessLink = await screen.findByRole('link', {
      name: 'Demander un accès',
    });
    expect(accessLink).toHaveAttribute('href', '/request-access');

    fireEvent.click(accessLink);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Demander un accès',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse e-mail')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument();
  });

  it('affiche une confirmation générique après la demande d’accès', async () => {
    window.history.pushState({}, '', '/request-access');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          {
            message:
              'Votre demande a été prise en compte. Les prochaines étapes vous seront communiquées par e-mail.',
          },
          202,
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.input(await screen.findByLabelText('Adresse e-mail'), {
      target: { value: 'learner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Demande enregistrée',
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/access-requests',
      expect.objectContaining({
          body: JSON.stringify({ email: 'learner@example.com', locale: 'fr' }),
        credentials: 'include',
        method: 'POST',
      }),
    );
  });

  it('initialise une nouvelle demande avec la langue du navigateur', async () => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    });
    window.history.pushState({}, '', '/request-access');
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ message: 'Request received.' }, 202)),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.input(await screen.findByLabelText('Email address'), {
      target: { value: 'english@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send my request' }));

    await screen.findByRole('heading', { name: 'Request submitted' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/access-requests',
      expect.objectContaining({
        body: JSON.stringify({ email: 'english@example.com', locale: 'en' }),
      }),
    );
  });

  it('désactive la demande d’accès hors ligne', async () => {
    window.history.pushState({}, '', '/request-access');
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Demander un accès',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Envoyer ma demande' }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('vérifie explicitement un e-mail sans envoyer le token dans la requête de page', async () => {
    const token = 'a'.repeat(43);
    window.history.pushState({}, '', `/verify-email#token=${token}`);
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          message:
            'Ton adresse e-mail est vérifiée. Ta demande est maintenant en attente d’approbation.',
          status: 'verified',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Vérifier mon adresse e-mail',
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Vérifier mon adresse' }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Adresse vérifiée',
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/access-requests/verify-email',
      expect.objectContaining({
        body: JSON.stringify({ token }),
        method: 'POST',
      }),
    );
    expect(window.location.hash).toBe('');
  });

  it('refuse une page de vérification sans token', async () => {
    window.history.pushState({}, '', '/verify-email');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByText(
        'Ce lien de vérification est invalide ou incomplet.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Vérifier mon adresse' }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restaure la session après un rechargement', async () => {
    window.history.pushState({}, '', '/today');
    mockSession({
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'USER',
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' }),
    ).toBeInTheDocument();
  });

  it('déplace le focus principal sans afficher de retour sur une racine', async () => {
    window.history.pushState({}, '', '/today');
    mockSession({
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'USER',
    });

    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' });
    fireEvent.click(screen.getByRole('link', { name: 'Profil' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Learner' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.getElementById('main-content')).toHaveFocus(),
    );
    expect(
      screen.queryByRole('button', { name: /Retour|Revenir/ }),
    ).not.toBeInTheDocument();
  });

  it('connecte un utilisateur puis met à jour la session locale', async () => {
    window.history.pushState({}, '', '/login');
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/login') {
        return Promise.resolve(
          jsonResponse({
            user: {
              id: 'user-1',
              email: 'learner@example.com',
              displayName: 'Learner',
              role: 'USER',
            },
          }),
        );
      }

      return Promise.resolve(jsonResponse({ user: null }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const emailField = await screen.findByLabelText('Adresse e-mail');
    fireEvent.input(emailField, { target: { value: 'learner@example.com' } });
    fireEvent.input(screen.getByLabelText('Mot de passe'), {
      target: { value: 'correct-horse-battery-staple' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('déconnecte l’utilisateur et le redirige vers la connexion', async () => {
    window.history.pushState({}, '', '/profile');
    const user = {
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'USER',
    };
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/logout') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(jsonResponse({ user }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Se déconnecter' }),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Connexion' }),
    ).toBeInTheDocument();
  });

  it('empile les actions du profil administrateur sans concurrence tactile', async () => {
    window.history.pushState({}, '', '/profile');
    const user = {
      id: 'admin-1',
      email:
        'administrateur-avec-une-adresse-volontairement-longue@example.com',
      displayName: 'Admin',
      role: 'ADMIN',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ user }))),
    );

    render(<App />);

    const email = await screen.findByText(user.email);
    const actions = screen.getByRole('heading', { level: 2, name: 'Accès' });
    const adminLink = screen.getByRole('link', {
      name: 'Ouvrir l’administration',
    });
    const logout = screen.getByRole('button', { name: 'Se déconnecter' });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Application' }),
    ).toBeInTheDocument();

    expect(email).toHaveClass('break-all');
    expect(adminLink).toHaveAttribute('href', '/admin');
    expect(adminLink).toHaveClass('ui-action--md', 'w-full');
    expect(adminLink).not.toHaveClass('underline');
    expect(logout).toHaveClass('ui-action--md', 'w-full');
    expect(actions.compareDocumentPosition(adminLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(adminLink.compareDocumentPosition(logout)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(adminLink.parentElement).toHaveClass('flex-col');
  });

  it('enregistre la langue du compte et met à jour le document immédiatement', async () => {
    window.history.pushState({}, '', '/profile');
    const user = {
      displayName: 'Learner',
      email: 'locale@example.com',
      id: 'user-locale',
      locale: 'fr',
      role: 'USER',
    };
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/auth/locale' && init?.method === 'PATCH') {
        return Promise.resolve(
          jsonResponse({ user: { ...user, locale: 'en' } }),
        );
      }
      return Promise.resolve(jsonResponse({ user }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const language = await screen.findByRole('combobox', {
      name: 'Langue de l’interface',
    });
    fireEvent.input(language, { target: { value: 'en' } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/locale',
        expect.objectContaining({
          body: JSON.stringify({ locale: 'en' }),
          method: 'PATCH',
        }),
      ),
    );
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(document.title).toBe('LearnX — Personal learning journey');
    expect(
      screen.getByRole('combobox', { name: 'Interface language' }),
    ).toHaveValue('en');
  });

  it('ne propose aucune navigation d’administration au rôle créateur', async () => {
    window.history.pushState({}, '', '/profile');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            user: {
              displayName: 'Créatrice',
              email: 'creator@example.test',
              id: 'creator-1',
              role: 'CREATOR',
            },
          }),
        ),
      ),
    );

    render(<App />);

    expect(await screen.findByText('creator@example.test')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ouvrir l’administration' }),
    ).not.toBeInTheDocument();
  });

  it('refuse la zone admin au rôle créateur sans charger ses données', async () => {
    window.history.pushState({}, '', '/admin');
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(
          jsonResponse({
            user: {
              displayName: 'Créatrice',
              email: 'creator@example.test',
              id: 'creator-1',
              role: 'CREATOR',
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Accès refusé' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restaure directement une URL admin profonde', async () => {
    const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
    const stageId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
    const moduleId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
    const lessonId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
    window.history.pushState(
      {},
      '',
      `/admin/program/${programId}/stage/${stageId}/module/${moduleId}/lesson/${lessonId}`,
    );
    const user = {
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'ADMIN',
    };
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse({ user }));
      }
      if (path === `/api/admin/lessons/${lessonId}`) {
        return Promise.resolve(
          jsonResponse({
            kind: 'LESSON',
            lesson: {
              id: lessonId,
              isPublished: false,
              position: 0,
              slug: 'lecon-test',
              summary: 'Résumé profond',
              title: 'Leçon profonde',
              module: {
                description: 'Résumé module',
                id: moduleId,
                isPublished: false,
                position: 0,
                slug: 'module-test',
                title: 'Module profond',
                stage: {
                  id: stageId,
                  isPublished: false,
                  position: 0,
                  slug: 'etape-test',
                  title: 'Étape profonde',
                  program: {
                    id: programId,
                    position: 0,
                    slug: 'programme-test',
                    status: 'DRAFT',
                    title: 'Programme profond',
                  },
                },
              },
            },
          }),
        );
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Leçon profonde' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Programme profond')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/lessons/${lessonId}`,
      expect.any(Object),
    );
  });
});
