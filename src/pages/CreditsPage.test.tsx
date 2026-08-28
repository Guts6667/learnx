import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { useCreditIncreaseRequestMutation } from '@/features/credits/credits';
import { CreditsPage } from '@/pages/CreditsPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function creditsResponse(pending = false) {
  return {
    credits: {
      accountStatus: 'ACTIVE',
      displayName: 'Rayan',
      email: 'rayan@example.test',
      history: [],
      pendingIncreaseRequest: pending
        ? {
            createdAt: '2026-08-26T08:00:00.000Z',
            id: 'request-1',
            reason: 'Besoin documenté',
          }
        : null,
      projection: {
        free: {
          available: '1200',
          consumed: '10',
          expired: '0',
          reserved: '40',
        },
        purchased: {
          available: '350',
          consumed: '5',
          expired: '0',
          reserved: '10',
        },
        totalAvailable: '1550',
        totalReserved: '50',
      },
      userId: 'user-1',
    },
  };
}

function CreditMutationHarness() {
  const mutation = useCreditIncreaseRequestMutation();

  return (
    <div>
      <button
        onClick={() =>
          void mutation.execute('Motif stable de test').catch(() => undefined)
        }
        type="button"
      >
        Envoyer
      </button>
      <button onClick={mutation.abandon} type="button">
        Abandonner
      </button>
      {mutation.error ? <p role="alert">Échec</p> : null}
    </div>
  );
}

describe('CreditsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('conserve des soldes offerts, achetés, totaux et réservés distincts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(creditsResponse()))),
    );

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText(
        (content, element) =>
          element?.tagName === 'STRONG' &&
          content.replace(/\s/g, '') === '1200',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(
      screen.getByText(
        (content, element) =>
          element?.tagName === 'STRONG' &&
          content.replace(/\s/g, '') === '1550',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Crédits achetés' }),
    ).toBeInTheDocument();
  });

  it('réessaie explicitement le chargement sans masquer l’erreur', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(() => {
      attempt += 1;
      return Promise.resolve(
        attempt === 1
          ? jsonResponse({ error: 'unavailable' }, 503)
          : jsonResponse(creditsResponse()),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Vos crédits n’ont pas pu être chargés.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByText(
        (content, element) =>
          element?.tagName === 'STRONG' &&
          content.replace(/\s/g, '') === '1200',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('crée une demande exceptionnelle sans créditer le compte', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === '/api/credits/increase-requests' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(jsonResponse({ request: { id: 'request-2' } }));
      }
      return Promise.resolve(jsonResponse(creditsResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    const reason = await screen.findByLabelText('Motif de la demande');
    fireEvent.input(reason, {
      target: { value: 'Allocation temporaire pour le pilote privé' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/credits/increase-requests',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const request = fetchMock.mock.calls.find(
      ([path]) => path === '/api/credits/increase-requests',
    );
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      reason: 'Allocation temporaire pour le pilote privé',
    });
    expect(
      await screen.findByText('Votre demande a été transmise.'),
    ).toBeInTheDocument();
  });

  it('conserve le motif et permet de réessayer une demande en échec', async () => {
    let postAttempt = 0;
    const postBodies: Array<{ idempotencyKey: string; reason: string }> = [];
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === '/api/credits/increase-requests' &&
        init?.method === 'POST'
      ) {
        postAttempt += 1;
        postBodies.push(
          JSON.parse(String(init.body)) as {
            idempotencyKey: string;
            reason: string;
          },
        );
        return Promise.resolve(
          postAttempt === 1
            ? jsonResponse({ error: 'unavailable' }, 503)
            : jsonResponse({ request: { id: 'request-2' } }),
        );
      }
      return Promise.resolve(jsonResponse(creditsResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    const reason = await screen.findByLabelText('Motif de la demande');
    fireEvent.input(reason, {
      target: { value: 'Allocation temporaire pour le pilote privé' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    expect(
      await screen.findByText('La demande n’a pas pu être envoyée.'),
    ).toBeInTheDocument();
    expect(reason).toHaveValue('Allocation temporaire pour le pilote privé');

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(
      await screen.findByText('Votre demande a été transmise.'),
    ).toBeInTheDocument();
    expect(reason).toHaveValue('');
    expect(postAttempt).toBe(2);
    expect(postBodies).toHaveLength(2);
    expect(postBodies[0]?.idempotencyKey).toBe(postBodies[1]?.idempotencyKey);
  });

  it('crée une nouvelle identité lorsque le motif est modifié après un échec', async () => {
    const postBodies: Array<{ idempotencyKey: string; reason: string }> = [];
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === '/api/credits/increase-requests' &&
        init?.method === 'POST'
      ) {
        postBodies.push(
          JSON.parse(String(init.body)) as {
            idempotencyKey: string;
            reason: string;
          },
        );
        return Promise.resolve(
          postBodies.length === 1
            ? jsonResponse({ error: 'unavailable' }, 503)
            : jsonResponse({ request: { id: 'request-2' } }),
        );
      }
      return Promise.resolve(jsonResponse(creditsResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    const reason = await screen.findByLabelText('Motif de la demande');
    fireEvent.input(reason, { target: { value: 'Premier motif documenté' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(
      await screen.findByText('La demande n’a pas pu être envoyée.'),
    ).toBeInTheDocument();

    fireEvent.input(reason, { target: { value: 'Second motif documenté' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(
      await screen.findByText('Votre demande a été transmise.'),
    ).toBeInTheDocument();

    expect(postBodies).toHaveLength(2);
    expect(postBodies[0]?.idempotencyKey).not.toBe(
      postBodies[1]?.idempotencyKey,
    );
  });

  it('crée une nouvelle identité après chaque succès', async () => {
    const idempotencyKeys: string[] = [];
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === '/api/credits/increase-requests' &&
        init?.method === 'POST'
      ) {
        const body = JSON.parse(String(init.body)) as {
          idempotencyKey: string;
        };
        idempotencyKeys.push(body.idempotencyKey);
        return Promise.resolve(jsonResponse({ request: { id: 'request-2' } }));
      }
      return Promise.resolve(jsonResponse(creditsResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    const reason = await screen.findByLabelText('Motif de la demande');
    fireEvent.input(reason, { target: { value: 'Motif répété documenté' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(
      await screen.findByText('Votre demande a été transmise.'),
    ).toBeInTheDocument();

    fireEvent.input(reason, { target: { value: 'Motif répété documenté' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(idempotencyKeys).toHaveLength(2));
    expect(idempotencyKeys[0]).not.toBe(idempotencyKeys[1]);
  });

  it('crée une nouvelle identité après un abandon explicite', async () => {
    const idempotencyKeys: string[] = [];
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === '/api/credits/increase-requests' &&
        init?.method === 'POST'
      ) {
        const body = JSON.parse(String(init.body)) as {
          idempotencyKey: string;
        };
        idempotencyKeys.push(body.idempotencyKey);
        return Promise.resolve(
          idempotencyKeys.length === 1
            ? jsonResponse({ error: 'unavailable' }, 503)
            : jsonResponse({ request: { id: 'request-2' } }),
        );
      }
      return Promise.resolve(jsonResponse(creditsResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <CreditMutationHarness />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec');
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(idempotencyKeys).toHaveLength(2));
    expect(idempotencyKeys[0]).not.toBe(idempotencyKeys[1]);
  });

  it('n’affiche aucun formulaire lorsqu’une demande est déjà en attente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(creditsResponse(true)))),
    );

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Une demande est déjà en attente de revue.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Envoyer la demande' }),
    ).not.toBeInTheDocument();
  });
});
