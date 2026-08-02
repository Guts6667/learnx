import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { App } from '@/app/App';

describe('App', () => {
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
});
