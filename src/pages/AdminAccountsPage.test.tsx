import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AdminAccountsPage } from '@/pages/AdminAccountsPage';

const adminId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const learnerId = 'ceffb1eb-0681-4c4d-bf50-50e673f65ca4';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function account(
  input: Partial<{
    accountStatus: 'ACTIVE' | 'SUSPENDED';
    displayName: string;
    email: string;
    id: string;
    role: 'ADMIN' | 'CREATOR' | 'USER';
    suspendedAt: string | null;
  }> = {},
) {
  return {
    accountStatus: 'ACTIVE' as const,
    createdAt: '2026-08-05T08:00:00.000Z',
    displayName: 'Learner',
    email: 'learner@example.com',
    id: learnerId,
    role: 'USER' as const,
    suspendedAt: null,
    updatedAt: '2026-08-05T08:00:00.000Z',
    ...input,
  };
}

function pageResponse(items = [account()]) {
  return {
    page: { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 },
  };
}

function sessionResponse() {
  return {
    user: {
      displayName: 'Admin',
      email: 'admin@example.com',
      id: adminId,
      role: 'ADMIN',
    },
  };
}

describe('AdminAccountsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('liste les comptes sans permettre la suspension du compte courant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (path === '/api/auth/session') {
          return Promise.resolve(jsonResponse(sessionResponse()));
        }
        return Promise.resolve(
          jsonResponse(
            pageResponse([
              account({
                displayName: 'Admin',
                email: 'admin@example.com',
                id: adminId,
                role: 'ADMIN',
              }),
              account(),
            ]),
          ),
        );
      }),
    );

    render(
      <AppProviders>
        <AdminAccountsPage />
      </AppProviders>,
    );

    expect(await screen.findByText('learner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Compte administrateur courant')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Suspendre le compte' }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Attribuer le rôle Créateur' }),
    ).toHaveLength(1);
  });

  it('attribue Créateur après une confirmation qui explicite sa frontière', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse(sessionResponse()));
      }
      if (path.endsWith(`/${learnerId}/role`)) {
        return Promise.resolve(
          jsonResponse({ account: account({ role: 'CREATOR' }) }),
        );
      }
      return Promise.resolve(jsonResponse(pageResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminAccountsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Attribuer le rôle Créateur',
      }),
    );
    expect(screen.getByText(/aucun accès à l’administration/)).toHaveTextContent(
      /ni création, ni édition, ni prévisualisation, ni publication avant V5/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/accounts/${learnerId}/role`,
        expect.objectContaining({
          body: JSON.stringify({
            expectedRole: 'USER',
            expectedUpdatedAt: '2026-08-05T08:00:00.000Z',
            role: 'CREATOR',
          }),
          method: 'POST',
        }),
      );
    });
    expect(
      await screen.findByText(/Le rôle Créateur est attribué/),
    ).toBeInTheDocument();
  });

  it('propose une rétrogradation sans suppression des données personnelles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (path === '/api/auth/session') {
          return Promise.resolve(jsonResponse(sessionResponse()));
        }
        return Promise.resolve(
          jsonResponse(pageResponse([account({ role: 'CREATOR' })])),
        );
      }),
    );

    render(
      <AppProviders>
        <AdminAccountsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rétrograder en Apprenant' }),
    );
    expect(screen.getByText(/notes, progressions, tentatives/)).toBeInTheDocument();
  });

  it('confirme une suspension en annonçant la révocation et la conservation', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse(sessionResponse()));
      }
      if (path.endsWith(`/${learnerId}/suspend`)) {
        return Promise.resolve(
          jsonResponse({
            account: account({
              accountStatus: 'SUSPENDED',
              suspendedAt: '2026-08-05T09:00:00.000Z',
            }),
          }),
        );
      }
      expect(init?.method).toBeUndefined();
      return Promise.resolve(jsonResponse(pageResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminAccountsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Suspendre le compte' }),
    );
    expect(screen.getByText('Confirmer la suspension')).toBeInTheDocument();
    expect(screen.getByText(/notes, progressions, tentatives/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/accounts/${learnerId}/suspend`,
        expect.objectContaining({
          body: JSON.stringify({
            expectedStatus: 'ACTIVE',
            expectedUpdatedAt: '2026-08-05T08:00:00.000Z',
          }),
          method: 'POST',
        }),
      );
    });
    expect(
      await screen.findByText(/toutes ses sessions ont été révoquées/),
    ).toBeInTheDocument();
  });

  it('réactive un compte sans promettre de restaurer sa session', async () => {
    const suspended = account({
      accountStatus: 'SUSPENDED',
      suspendedAt: '2026-08-05T09:00:00.000Z',
    });
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse(sessionResponse()));
      }
      if (path.endsWith(`/${learnerId}/reactivate`)) {
        return Promise.resolve(jsonResponse({ account: account() }));
      }
      return Promise.resolve(jsonResponse(pageResponse([suspended])));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminAccountsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Réactiver le compte' }),
    );
    expect(
      screen.getByText(/Aucune ancienne session ne sera restaurée/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/accounts/${learnerId}/reactivate`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('filtre par statut et recherche', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse(sessionResponse()));
      }
      return Promise.resolve(jsonResponse(pageResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <AdminAccountsPage />
      </AppProviders>,
    );
    await screen.findByText('learner@example.com');

    fireEvent.change(screen.getByLabelText('Statut du compte'), {
      target: { value: 'SUSPENDED' },
    });
    fireEvent.input(screen.getByLabelText('Rechercher un compte'), {
      target: { value: 'learner' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('status=SUSPENDED'),
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('search=learner'),
        expect.any(Object),
      );
    });
  });
});
