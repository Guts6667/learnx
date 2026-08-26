import { fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { AdminRoute } from '@/features/auth/AdminRoute';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('AdminRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails closed without presenting a transport error as an authorization denial', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503))
      .mockResolvedValueOnce(
        jsonResponse({
          user: {
            displayName: 'Admin',
            email: 'admin@example.com',
            id: 'admin-1',
            locale: 'fr',
            role: 'ADMIN',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminRoute>
          <p>Administration privée</p>
        </AdminRoute>
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Connexion impossible',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration privée')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Administration privée')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the admin surface hidden from an authenticated non-admin user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            user: {
              displayName: 'Learner',
              email: 'learner@example.com',
              id: 'learner-1',
              locale: 'fr',
              role: 'USER',
            },
          }),
        ),
      ),
    );

    render(
      <AppProviders>
        <AdminRoute>
          <p>Administration privée</p>
        </AdminRoute>
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Accès refusé' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Administration privée')).not.toBeInTheDocument();
  });
});
