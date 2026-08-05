import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AdminAccessRequestsPage } from '@/pages/AdminAccessRequestsPage';

const requestId = '1d8cf94c-d690-430e-a3c0-c3ef68ca857a';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function pendingRequest() {
  return {
    assignedRole: null,
    createdAt: '2026-08-05T08:00:00.000Z',
    emailNormalized: 'candidate@example.com',
    emailVerifiedAt: '2026-08-05T08:05:00.000Z',
    id: requestId,
    invitationExpiresAt: null,
    rejectionReason: null,
    reviewedAt: null,
    status: 'PENDING_APPROVAL',
    version: 2,
  };
}

function pageResponse() {
  return {
    page: {
      items: [pendingRequest()],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    },
  };
}

describe('AdminAccessRequestsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('filtre les demandes vérifiées et expose une décision en deux temps', async () => {
    const fetchMock = vi.fn((path: string) => {
      expect(path).toContain('/api/admin/access-requests?');
      return Promise.resolve(jsonResponse(pageResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminAccessRequestsPage />
      </AppProviders>,
    );

    expect(await screen.findByText('candidate@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'État des demandes' }),
    ).toHaveValue('PENDING_APPROVAL');

    fireEvent.input(screen.getByLabelText('Rechercher par e-mail'), {
      target: { value: 'candidate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('search=candidate'),
        expect.any(Object),
      );
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Accepter' }),
    );
    expect(screen.getByLabelText('Rôle à attribuer')).toHaveValue('USER');
    fireEvent.click(
      screen.getByRole('button', { name: 'Prévisualiser la décision' }),
    );
    expect(screen.getByText('Confirmer la décision')).toBeInTheDocument();
    expect(
      screen.getByText(/Une invitation sera préparée, sans créer de compte/),
    ).toBeInTheDocument();
  });

  it('confirme une acceptation avec la version et le rôle choisis', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path.endsWith(`/${requestId}/approve`)) {
        return Promise.resolve(
          jsonResponse({
            request: {
              ...pendingRequest(),
              assignedRole: 'CREATOR',
              status: 'APPROVED',
              version: 3,
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse(pageResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminAccessRequestsPage />
      </AppProviders>,
    );

    await screen.findByText('candidate@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    fireEvent.change(screen.getByLabelText('Rôle à attribuer'), {
      target: { value: 'CREATOR' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Prévisualiser la décision' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/access-requests/${requestId}/approve`,
        expect.objectContaining({
          body: JSON.stringify({ expectedVersion: 2, role: 'CREATOR' }),
          method: 'POST',
        }),
      );
    });
  });

  it('exige un motif interne avant de confirmer un refus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(pageResponse()))),
    );

    render(
      <AppProviders>
        <AdminAccessRequestsPage />
      </AppProviders>,
    );

    await screen.findByText('candidate@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Refuser' }));
    expect(
      screen.getByRole('button', { name: 'Prévisualiser la décision' }),
    ).toBeDisabled();
    fireEvent.input(screen.getByLabelText('Motif du refus'), {
      target: { value: 'Demande hors périmètre.' },
    });
    expect(
      screen.getByRole('button', { name: 'Prévisualiser la décision' }),
    ).toBeEnabled();
  });

  it('permet de renouveler une invitation approuvée', async () => {
    const approvedRequest = {
      ...pendingRequest(),
      assignedRole: 'USER',
      invitationExpiresAt: '2026-08-12T08:05:00.000Z',
      reviewedAt: '2026-08-05T08:10:00.000Z',
      status: 'APPROVED',
      version: 3,
    };
    const fetchMock = vi.fn((path: string) => {
      if (path.endsWith(`/${requestId}/resend-invitation`)) {
        return Promise.resolve(
          jsonResponse({
            request: { ...approvedRequest, version: 4 },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          page: {
            items: [approvedRequest],
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminAccessRequestsPage />
      </AppProviders>,
    );
    fireEvent.change(
      screen.getByRole('combobox', { name: 'État des demandes' }),
      { target: { value: 'APPROVED' } },
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Renvoyer l’invitation' }),
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/access-requests/${requestId}/resend-invitation`,
        expect.objectContaining({
          body: JSON.stringify({ expectedVersion: 3 }),
          method: 'POST',
        }),
      );
    });
  });
});
