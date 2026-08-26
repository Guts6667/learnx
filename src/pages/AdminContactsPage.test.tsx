import { fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { AdminContactsPage } from '@/pages/AdminContactsPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function contactsResponse() {
  return {
    page: {
      earlyAdopterApplications: 7,
      items: [
        {
          createdAt: '2026-08-10T09:00:00.000Z',
          emailNormalized: 'reader@example.com',
          id: '00000000-0000-4000-8000-000000000004',
          purposes: [
            {
              confirmedAt: '2026-08-10T10:00:00.000Z',
              createdAt: '2026-08-10T09:00:00.000Z',
              locale: 'fr',
              motivation: null,
              purpose: 'LAUNCH_UPDATES',
              status: 'CONFIRMED',
            },
            {
              confirmedAt: null,
              createdAt: '2026-08-10T09:30:00.000Z',
              locale: 'fr',
              motivation: 'Je souhaite contribuer aux retours produit.',
              purpose: 'EARLY_ADOPTER',
              status: 'PENDING_CONFIRMATION',
            },
          ],
        },
      ],
      launchUpdatesConfirmed: 12,
      limit: 20,
      offset: 0,
      total: 1,
    },
  };
}

describe('AdminContactsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche deux métriques sincères et une seule ligne par contact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(contactsResponse()))),
    );

    render(
      <AppProviders>
        <AdminContactsPage />
      </AppProviders>,
    );

    expect(await screen.findByText('reader@example.com')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Confirmé')).toBeInTheDocument();
    expect(screen.getByText('À confirmer')).toBeInTheDocument();
    expect(screen.getAllByText('reader@example.com')).toHaveLength(1);
  });

  it('transmet recherche et finalité sans les confondre', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(contactsResponse())),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <AdminContactsPage />
      </AppProviders>,
    );
    await screen.findByText('reader@example.com');

    fireEvent.input(screen.getByLabelText('Rechercher par e-mail'), {
      target: { value: 'reader' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    fireEvent.change(screen.getByLabelText('Finalité'), {
      target: { value: 'EARLY_ADOPTER' },
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('purpose=EARLY_ADOPTER'),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('search=reader'),
        expect.anything(),
      );
    });
  });
});
