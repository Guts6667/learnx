import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { navigate } from '@/app/navigation';
import { AppProviders } from '@/app/providers';
import { useCreditIncreaseRequestMutation } from '@/features/credits/credits';
import { CreditsPage } from '@/pages/CreditsPage';

vi.mock('@/app/navigation', () => ({ navigate: vi.fn() }));

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

/**
 * L'écran lit trois surfaces : ses soldes, le catalogue et ses commandes. Un
 * mock qui répond la même chose à tout rendrait vertes des pages qui n'ont
 * jamais reçu la bonne forme — c'est exactement ce que `useObservedQuery`
 * existe pour empêcher (V4.5-182). Chaque test part donc d'un routeur qui
 * répond par chemin, et ne remplace que ce qu'il veut éprouver.
 */
function defaultResponse(path: string): Response {
  if (path === '/api/credits/packs')
    return jsonResponse({ packs: [], paymentsEnabled: true });
  if (path === '/api/credits/orders') return jsonResponse({ orders: [] });
  return jsonResponse(creditsResponse());
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
      vi.fn((path: string) => Promise.resolve(defaultResponse(path))),
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
    const fetchMock = vi.fn((path: string) => {
      if (path !== '/api/credits') {
        return Promise.resolve(defaultResponse(path));
      }
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
    expect(attempt).toBe(2);
  });

  it('crée une demande exceptionnelle sans créditer le compte', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === '/api/credits/increase-requests' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(jsonResponse({ request: { id: 'request-2' } }));
      }
      return Promise.resolve(defaultResponse(path));
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
      return Promise.resolve(defaultResponse(path));
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
      return Promise.resolve(defaultResponse(path));
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
      return Promise.resolve(defaultResponse(path));
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
      return Promise.resolve(defaultResponse(path));
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
      vi.fn((path: string) =>
        Promise.resolve(
          path === '/api/credits'
            ? jsonResponse(creditsResponse(true))
            : defaultResponse(path),
        ),
      ),
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

/**
 * L'achat de crédits (V4.5-204).
 *
 * Deux choses sont éprouvées ici plutôt que relues : que l'écran n'écrit
 * jamais un prix ni un montant de son cru, et qu'il n'affirme l'attribution
 * des crédits qu'au moment où le serveur la dit. Revenir de la page de
 * paiement ne prouve que la fin d'une session : c'est le webhook qui fait foi.
 */
describe('CreditsPage — achat de crédits', () => {
  const pack = {
    credits: '100',
    currency: 'EUR',
    key: 'starter',
    label: 'Découverte',
    labelEn: 'Starter',
    priceMinor: '1500',
  };
  const fulfilledOrder = {
    amountMinor: '1500',
    createdAt: '2026-08-30T10:00:00.000Z',
    currency: 'EUR',
    fulfilledAt: '2026-08-30T10:00:20.000Z',
    id: 'order-1',
    packKey: 'starter',
    status: 'FULFILLED',
  };
  const checkoutUrl = 'https://checkout.example.test/session';

  function stub(
    routes: Record<string, (init?: RequestInit) => Response>,
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      const handler = routes[path];
      return Promise.resolve(handler ? handler(init) : defaultResponse(path));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  /** « 15,00 € » sans dépendre de l'espace qu'Intl place avant le symbole. */
  function amount(text: string) {
    return (content: string) => content.replace(/\s/gu, '') === text;
  }

  beforeEach(() => vi.mocked(navigate).mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it('affiche les paliers du catalogue et part vers la page de paiement', async () => {
    const fetchMock = stub({
      '/api/credits/checkout': () =>
        jsonResponse({
          resource: {
            checkout: {
              correctionSuspended: false,
              orderId: 'order-1',
              url: checkoutUrl,
            },
          },
        }),
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: true }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Découverte' }),
    ).toBeInTheDocument();
    // Le prix vient du catalogue et n'est mis en forme qu'ici : aucun montant
    // n'est écrit dans l'écran, et aucun n'est recalculé à partir des crédits.
    expect(screen.getByText(amount('15,00€'))).toBeInTheDocument();
    expect(screen.getByText('100 crédits')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Acheter Découverte' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(checkoutUrl));
    const started = fetchMock.mock.calls.find(
      ([path]) => path === '/api/credits/checkout',
    );
    expect(JSON.parse(String(started?.[1]?.body))).toEqual({
      packKey: 'starter',
    });
  });

  it('ne redirige pas avant d’avoir dit que la correction est suspendue', async () => {
    stub({
      '/api/credits/checkout': () =>
        jsonResponse({
          resource: {
            checkout: {
              correctionSuspended: true,
              orderId: 'order-1',
              url: checkoutUrl,
            },
          },
        }),
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: true }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Acheter Découverte' }),
    );

    expect(
      await screen.findByText(
        'La correction par IA est suspendue en ce moment. Les crédits achetés gardent leur valeur et resteront utilisables à sa reprise.',
      ),
    ).toBeInTheDocument();
    // Le fait est vrai à cet instant précis, et c'est le dernier où l'apprenant
    // peut encore renoncer : la redirection attend qu'il ait répondu.
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Continuer vers le paiement' }),
    );
    expect(navigate).toHaveBeenCalledWith(checkoutUrl);
  });

  it('n’affirme l’attribution des crédits que lorsque la commande la porte', async () => {
    let settled = false;
    stub({
      '/api/credits/orders': () =>
        jsonResponse({ orders: settled ? [fulfilledOrder] : [] }),
    });

    render(
      <AppProviders>
        <CreditsPage checkout="success" orderId="order-1" />
      </AppProviders>,
    );

    // Être renvoyé ici ne prouve rien sur l'attribution : la commande n'est pas
    // encore lisible, donc l'écran dit l'attente et rien de plus.
    expect(
      await screen.findByRole('heading', { name: 'Paiement reçu' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Crédits attribués' }),
    ).not.toBeInTheDocument();

    settled = true;
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));

    // Le titre de l'avis, pas l'état de la ligne de commande : la commande
    // apparaît aussi dans l'historique, et c'est bien deux fois la même
    // information, dite au bon endroit.
    expect(
      await screen.findByRole('heading', { name: 'Crédits attribués' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Actualiser' }),
    ).not.toBeInTheDocument();
  });

  it('dit l’abandon sans rien affirmer d’autre', async () => {
    stub({});

    render(
      <AppProviders>
        <CreditsPage checkout="cancelled" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Achat abandonné' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Aucun crédit n’a été ajouté à votre solde.'),
    ).toBeInTheDocument();
  });

  it('sait la vente fermée avant le clic, garde les paliers et retire les boutons', async () => {
    // Le catalogue porte l'état de la vente (V4.5-205) : l'écran n'a plus à
    // l'apprendre du 503 d'un achat qu'il vient de proposer. Les paliers
    // restent visibles — les faire disparaître donnerait une page vide, qui
    // ressemble à une panne — et aucun bouton n'invite à un achat impossible.
    stub({
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: false }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'L’achat de crédits est fermé',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Découverte' }),
    ).toBeInTheDocument();
    expect(screen.getByText(amount('15,00€'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Acheter/u }),
    ).not.toBeInTheDocument();
  });

  it('relit le catalogue quand le serveur dit que la vente vient de fermer', async () => {
    let saleOpen = true;
    const fetchMock = stub({
      '/api/credits/checkout': () => {
        saleOpen = false;
        return jsonResponse(
          {
            error: {
              code: 'PRICING_UNAVAILABLE',
              message: 'Purchases are unavailable.',
            },
          },
          503,
        );
      },
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: saleOpen }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Acheter Découverte' }),
    );

    expect(
      await screen.findByText(
        'La vente de crédits vient d’être fermée. Aucun montant n’a été prélevé.',
      ),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    // Le serveur vient de contredire le catalogue affiché : on le relit, plutôt
    // que de garder à l'écran un état qu'il a démenti.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([path]) => path === '/api/credits/packs')
          .length,
      ).toBeGreaterThan(1),
    );
    expect(
      screen.queryByRole('button', { name: 'Acheter Découverte' }),
    ).not.toBeInTheDocument();
  });

  it('dit qu’un palier a disparu sans le confondre avec une panne', async () => {
    stub({
      '/api/credits/checkout': () =>
        jsonResponse(
          { error: { code: 'RESOURCE_NOT_FOUND', message: 'Pack not found.' } },
          404,
        ),
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: true }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Acheter Découverte' }),
    );

    expect(
      await screen.findByText(
        'Ce palier n’est plus disponible. Aucun montant n’a été prélevé.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Le paiement n’a pas pu être démarré.'),
    ).not.toBeInTheDocument();
  });

  it('rend une erreur inattendue comme une erreur, jamais comme un refus', async () => {
    stub({
      '/api/credits/checkout': () =>
        jsonResponse(
          { error: { code: 'INTERNAL_ERROR', message: 'Boom.' } },
          500,
        ),
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: true }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Acheter Découverte' }),
    );

    expect(
      await screen.findByText('Le paiement n’a pas pu être démarré.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Acheter Découverte' }),
    ).toBeInTheDocument();
  });

  it('propose un écran explicite quand aucun palier n’est en vente', async () => {
    stub({});

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('L’achat de crédits n’est pas encore ouvert'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Acheter/u }),
    ).not.toBeInTheDocument();
  });

  it('liste les commandes de l’apprenant avec leur état', async () => {
    stub({
      '/api/credits/orders': () =>
        jsonResponse({
          orders: [
            fulfilledOrder,
            {
              amountMinor: '1500',
              createdAt: '2026-08-29T10:00:00.000Z',
              currency: 'EUR',
              fulfilledAt: null,
              id: 'order-2',
              packKey: 'starter',
              status: 'REFUNDED',
            },
          ],
        }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    const history = await screen.findByRole('list');
    expect(within(history).getByText('Crédits attribués')).toBeInTheDocument();
    expect(within(history).getByText('Remboursée')).toBeInTheDocument();
    expect(within(history).getAllByText(amount('15,00€'))).toHaveLength(2);
  });

  it('refuse une réponse de paiement hors contrat plutôt que de rediriger', async () => {
    stub({
      // `url` manquante : une redirection à l'aveugle vaudrait mieux que rien
      // partout ailleurs, pas ici — celle-ci mène à une page de paiement.
      '/api/credits/checkout': () =>
        jsonResponse({
          resource: { checkout: { correctionSuspended: false, orderId: 'o' } },
        }),
      '/api/credits/packs': () =>
        jsonResponse({ packs: [pack], paymentsEnabled: true }),
    });

    render(
      <AppProviders>
        <CreditsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Acheter Découverte' }),
    );

    expect(
      await screen.findByText('Le paiement n’a pas pu être démarré.'),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
