import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { AdminCreditsPage } from '@/pages/AdminCreditsPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('AdminCreditsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('permet de relancer uniquement la liste des membres après une erreur serveur', async () => {
    let memberAttempts = 0;
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/admin/ai-corrections/preflight') {
        return Promise.resolve(
          jsonResponse({
            preflight: {
              apiKeyPresent: true,
              deploymentEnvironment: 'preview',
              identityMatches: true,
              killSwitch: true,
              promotedBenchmarkId: 'benchmark-id',
              state: 'CONFIGURED_CLOSED',
            },
          }),
        );
      }
      if (path === '/api/admin/ai-corrections/monitoring') {
        return Promise.resolve(
          jsonResponse({
            monitoring: {
              breaker: {
                evaluationError: null,
                rates: {
                  checkerDisagreement: null,
                  unusable: null,
                  wrongAtHigh: null,
                },
                reason: null,
                state: 'CLOSED',
                thresholds: {
                  checkerDisagreement: 0.4,
                  unusable: 0.05,
                  wrongAtHigh: 0.1,
                },
                trippedAt: null,
                window: { observed: 0, size: 50 },
              },
              checker: { disagreed: 0, unavailable: 0 },
              confidence: { high: 0, low: 0, medium: 0, scoreWithheld: 0 },
              corrections: { completed: 0, partial: 0, total: 0, unusable: 0 },
              cost: {
                p50Usd: '0.00000000',
                p90Usd: '0.00000000',
                totalUsd: '0.00000000',
                unknownCostAttempts: 0,
              },
              learner: { helpful: 0, wrong: 0, wrongAtHigh: 0 },
            },
          }),
        );
      }
      if (path === '/api/admin/credits/policies') {
        return Promise.resolve(
          jsonResponse({ policies: { allocation: [], limits: [] } }),
        );
      }
      if (path.startsWith('/api/admin/credits/members?')) {
        memberAttempts += 1;
        return Promise.resolve(
          memberAttempts === 1
            ? jsonResponse({ error: 'unavailable' }, 503)
            : jsonResponse({
                page: {
                  items: [],
                  page: 1,
                  pageSize: 20,
                  total: 0,
                  totalPages: 0,
                },
              }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('La liste des crédits n’a pas pu être chargée.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Réessayer' })[0]);
    expect(
      await screen.findByRole('heading', { name: 'Aucun membre' }),
    ).toBeInTheDocument();
    expect(memberAttempts).toBe(2);
  });

  it('shows the real correction cost and incident summary without adding an admin navigation item', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (path === '/api/admin/ai-corrections/preflight') {
          return Promise.resolve(
            jsonResponse({
              preflight: {
                apiKeyPresent: true,
                deploymentEnvironment: 'preview',
                identityMatches: true,
                killSwitch: true,
                promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
                state: 'CONFIGURED_CLOSED',
              },
            }),
          );
        }
        if (path === '/api/admin/ai-corrections/monitoring') {
          return Promise.resolve(
            jsonResponse({
              monitoring: {
                breaker: {
                  evaluationError: null,
                  rates: {
                    checkerDisagreement: 0.12,
                    unusable: 0.08,
                    wrongAtHigh: null,
                  },
                  reason: null,
                  state: 'CLOSED',
                  thresholds: {
                    checkerDisagreement: 0.4,
                    unusable: 0.05,
                    wrongAtHigh: 0.1,
                  },
                  trippedAt: null,
                  window: { observed: 12, size: 50 },
                },
                checker: { disagreed: 2, unavailable: 1 },
                confidence: { high: 4, low: 3, medium: 5, scoreWithheld: 4 },
                corrections: {
                  completed: 8,
                  partial: 3,
                  total: 12,
                  unusable: 1,
                },
                cost: {
                  p50Usd: '0.00300000',
                  p90Usd: '0.00900000',
                  totalUsd: '0.05200000',
                  unknownCostAttempts: 0,
                },
                learner: { helpful: 6, wrong: 2, wrongAtHigh: 1 },
              },
            }),
          );
        }
        if (path === '/api/admin/credits/policies') {
          return Promise.resolve(
            jsonResponse({ policies: { allocation: [], limits: [] } }),
          );
        }
        if (path.startsWith('/api/admin/credits/members?')) {
          return Promise.resolve(
            jsonResponse({
              page: {
                items: [],
                page: 1,
                pageSize: 20,
                total: 0,
                totalPages: 0,
              },
            }),
          );
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Coûts et incidents de correction',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('0.05200000 USD')).toBeInTheDocument();
    expect(
      await screen.findByText('Correction configurée — coupe-circuit fermé'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Environnement preview · identité learnx-french-text-correction-v3-1/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // Le seul chiffre de cet écran qui ne vienne pas de l'opinion du système
    // sur lui-même est mis en tête.
    expect(
      screen.getByText(
        'Critères annoncés fiables et contredits par un apprenant',
      ),
    ).toBeInTheDocument();
    // Un taux mesurable est rendu ; un taux non mesurable dit qu'il ne l'est
    // pas, au lieu d'afficher un zéro rassurant.
    expect(screen.getByText('12.0 %')).toBeInTheDocument();
    expect(screen.getByText('Pas assez de données')).toBeInTheDocument();
    // 8 % au-dessus d'un seuil de 5 %, mais l'état reste fermé : la
    // suspension a lieu au prochain devis, pas à l'ouverture de cette page.
    expect(screen.getByText('8.0 %')).toBeInTheDocument();
    expect(
      screen.getByText('Seuil franchi — suspension au prochain devis'),
    ).toBeInTheDocument();
    expect(screen.getByText('Service ouvert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Rouvrir le service…' }),
    ).not.toBeInTheDocument();
  });

  function breakerMock(
    breaker: Record<string, unknown>,
    onPost?: (init?: RequestInit) => void,
  ) {
    return vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/admin/ai-corrections/breaker/reopen') {
        onPost?.(init);
        return Promise.resolve(
          jsonResponse({
            resource: { breaker: { ...breaker, state: 'CLOSED' } },
          }),
        );
      }
      if (path === '/api/admin/ai-corrections/preflight') {
        return Promise.resolve(
          jsonResponse({
            preflight: {
              apiKeyPresent: true,
              deploymentEnvironment: 'preview',
              identityMatches: true,
              killSwitch: true,
              promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
              state: 'CONFIGURED_CLOSED',
            },
          }),
        );
      }
      if (path === '/api/admin/ai-corrections/monitoring') {
        return Promise.resolve(
          jsonResponse({
            monitoring: {
              breaker,
              checker: { disagreed: 9, unavailable: 0 },
              confidence: { high: 2, low: 8, medium: 4, scoreWithheld: 8 },
              corrections: {
                completed: 6,
                partial: 2,
                total: 20,
                unusable: 12,
              },
              cost: {
                p50Usd: '0.00300000',
                p90Usd: '0.00900000',
                totalUsd: '0.08000000',
                unknownCostAttempts: 0,
              },
              learner: { helpful: 3, wrong: 5, wrongAtHigh: 4 },
            },
          }),
        );
      }
      if (path === '/api/admin/credits/policies') {
        return Promise.resolve(
          jsonResponse({ policies: { allocation: [], limits: [] } }),
        );
      }
      if (path.startsWith('/api/admin/credits/members')) {
        return Promise.resolve(
          jsonResponse({
            page: {
              items: [],
              page: 1,
              pageSize: 20,
              total: 0,
              totalPages: 0,
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
  }

  it('rend un état d’erreur, jamais une page partielle, quand le serveur change de forme', async () => {
    // Littéralement la forme que /monitoring renvoyait avant V4.5-140, et que
    // le type client a continué d'affirmer après. La page affichait alors
    // sept `undefined` sans que rien ne rougisse.
    const legacy = vi.fn((path: string) => {
      if (path === '/api/admin/ai-corrections/monitoring') {
        return Promise.resolve(
          jsonResponse({
            monitoring: {
              completed: 0,
              hardConstraintLevelMismatchSuspected: 0,
              partial: 0,
              scoreGuardTriggered: 0,
              totalCorrections: 12,
              totalProviderCostUsd: '0.05200000',
              unavailable: 0,
              unknownCostAttempts: 0,
            },
          }),
        );
      }
      if (path === '/api/admin/ai-corrections/preflight') {
        return Promise.resolve(
          jsonResponse({
            preflight: {
              apiKeyPresent: true,
              deploymentEnvironment: 'preview',
              identityMatches: true,
              killSwitch: true,
              promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
              state: 'CONFIGURED_CLOSED',
            },
          }),
        );
      }
      if (path === '/api/admin/credits/policies') {
        return Promise.resolve(
          jsonResponse({ policies: { allocation: [], limits: [] } }),
        );
      }
      if (path.startsWith('/api/admin/credits/members')) {
        return Promise.resolve(
          jsonResponse({
            page: { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', legacy);

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText(
        'Les mesures de correction n’ont pas pu être chargées.',
      ),
    ).toBeInTheDocument();

    // Et surtout : aucune valeur n'est rendue à partir d'une forme inconnue.
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.queryByText('0.05200000 USD')).not.toBeInTheDocument();
    expect(screen.queryByText('Coupe-circuit')).not.toBeInTheDocument();
  });

  it('rend un coupe-circuit ouvert avec son motif, et exige une confirmation pour rouvrir', async () => {
    const posts: Array<RequestInit | undefined> = [];
    vi.stubGlobal(
      'fetch',
      breakerMock(
        {
          evaluationError: null,
          rates: {
            checkerDisagreement: null,
            unusable: null,
            wrongAtHigh: null,
          },
          reason: 'UNUSABLE_RATE',
          state: 'OPEN',
          thresholds: {
            checkerDisagreement: 0.4,
            unusable: 0.05,
            wrongAtHigh: 0.1,
          },
          trippedAt: '2026-08-29T14:31:00.000Z',
          window: { observed: 50, size: 50 },
        },
        (init) => posts.push(init),
      ),
    );

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    expect(await screen.findByText('Service suspendu')).toBeInTheDocument();
    // Le motif apparaît deux fois — en tête, et comme règle franchie. On
    // vérifie la ligne de tête, seule à porter la date de suspension.
    expect(
      screen.getByText(/Corrections sans résultat exploitable · suspendu le/),
    ).toBeInTheDocument();
    // Les taux ne sont pas mesurés quand le coupe-circuit est verrouillé :
    // l'écran le dit au lieu d'afficher trois zéros.
    expect(screen.getAllByText('Pas assez de données')).toHaveLength(3);

    // La réouverture ne part pas au premier clic.
    fireEvent.click(
      screen.getByRole('button', { name: 'Rouvrir le service…' }),
    );
    expect(posts).toHaveLength(0);

    fireEvent.input(
      screen.getByLabelText('Motif de la réouverture (facultatif)'),
      {
        target: { value: 'Fournisseur rétabli, vérifié sur dix corrections.' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rouvrir le service' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(String(posts[0]?.body))).toEqual({
      note: 'Fournisseur rétabli, vérifié sur dix corrections.',
    });
  });

  it('annonce un garde-fou aveugle plutôt qu’un service sain', async () => {
    vi.stubGlobal(
      'fetch',
      breakerMock({
        evaluationError: 'BREAKER_EVALUATION_FAILED',
        rates: {
          checkerDisagreement: null,
          unusable: null,
          wrongAtHigh: null,
        },
        reason: null,
        state: 'CLOSED',
        thresholds: {
          checkerDisagreement: 0.4,
          unusable: 0.05,
          wrongAtHigh: 0.1,
        },
        trippedAt: null,
        window: { observed: 0, size: 50 },
      }),
    );

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    // L'état reste ouvert — c'est délibéré côté serveur — mais l'écran ne
    // laisse pas croire que les règles sont vérifiées.
    expect(await screen.findByText('Service ouvert')).toBeInTheDocument();
    expect(
      screen.getByText(/n’a pas pu être mesuré : BREAKER_EVALUATION_FAILED/),
    ).toBeInTheDocument();
  });

  it('submits an offered-credit adjustment only after the admin reviews its summary', async () => {
    const requests: Array<{ init?: RequestInit; path: string }> = [];
    const projection = {
      free: { available: '0', consumed: '0', expired: '0', reserved: '0' },
      purchased: {
        available: '0',
        consumed: '0',
        expired: '0',
        reserved: '0',
      },
      totalAvailable: '0',
      totalReserved: '0',
    };
    const member = {
      accountStatus: 'ACTIVE',
      displayName: 'Rayan',
      email: 'rayanchambet1@gmail.com',
      history: [],
      pendingIncreaseRequest: null,
      projection,
      userId: 'user-rayan',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        requests.push({ init, path });
        if (path === '/api/admin/ai-corrections/preflight') {
          return Promise.resolve(
            jsonResponse({
              preflight: {
                apiKeyPresent: true,
                deploymentEnvironment: 'preview',
                identityMatches: true,
                killSwitch: true,
                promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
                state: 'CONFIGURED_CLOSED',
              },
            }),
          );
        }
        if (path === '/api/admin/ai-corrections/monitoring') {
          return Promise.resolve(
            jsonResponse({
              monitoring: {
                breaker: {
                  evaluationError: null,
                  rates: {
                    checkerDisagreement: null,
                    unusable: null,
                    wrongAtHigh: null,
                  },
                  reason: null,
                  state: 'CLOSED',
                  thresholds: {
                    checkerDisagreement: 0.4,
                    unusable: 0.05,
                    wrongAtHigh: 0.1,
                  },
                  trippedAt: null,
                  window: { observed: 0, size: 50 },
                },
                checker: { disagreed: 0, unavailable: 0 },
                confidence: { high: 0, low: 0, medium: 0, scoreWithheld: 0 },
                corrections: {
                  completed: 0,
                  partial: 0,
                  total: 0,
                  unusable: 0,
                },
                cost: {
                  p50Usd: '0.00000000',
                  p90Usd: '0.00000000',
                  totalUsd: '0.00000000',
                  unknownCostAttempts: 0,
                },
                learner: { helpful: 0, wrong: 0, wrongAtHigh: 0 },
              },
            }),
          );
        }
        if (path === '/api/admin/credits/policies') {
          return Promise.resolve(
            jsonResponse({ policies: { allocation: [], limits: [] } }),
          );
        }
        if (path.startsWith('/api/admin/credits/members?')) {
          return Promise.resolve(
            jsonResponse({
              page: {
                items: [member],
                page: 1,
                pageSize: 20,
                total: 1,
                totalPages: 1,
              },
            }),
          );
        }
        if (path === '/api/admin/credits/members/user-rayan') {
          return Promise.resolve(jsonResponse({ member }));
        }
        if (
          path === '/api/admin/credits/members/user-rayan/adjustments' &&
          init?.method === 'POST'
        ) {
          return Promise.resolve(jsonResponse({ member }));
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Ajuster' }));
    fireEvent.input(
      await screen.findByRole('textbox', { name: 'Montant en crédits' }),
      { target: { value: '6' } },
    );
    fireEvent.input(
      screen.getByRole('textbox', { name: 'Motif obligatoire' }),
      {
        target: { value: '123' },
      },
    );
    const reviewButton = screen.getByRole('button', {
      name: 'Vérifier le récapitulatif',
    });
    expect(reviewButton).toBeEnabled();
    fireEvent.click(reviewButton);

    expect(
      await screen.findByRole('heading', {
        name: 'Récapitulatif avant validation',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() =>
      expect(
        requests.some(
          ({ init, path }) =>
            path === '/api/admin/credits/members/user-rayan/adjustments' &&
            init?.method === 'POST',
        ),
      ).toBe(true),
    );
  });
});
