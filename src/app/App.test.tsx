import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { App } from '@/app/App';

describe('App', () => {
  beforeEach(() => {
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

  it('redirige une route privée vers la connexion sans session', async () => {
    window.history.pushState({}, '', '/today');
    mockSession(null);

    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Connexion' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
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

  it('déplace le focus principal et affiche le retour après navigation', async () => {
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
      screen.getByRole('button', { name: 'Revenir à la page précédente' }),
    ).toBeInTheDocument();
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
