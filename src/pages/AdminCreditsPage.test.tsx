import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

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
      if (path === '/api/admin/ai-corrections/breaker/events') {
        return Promise.resolve(jsonResponse({ resource: { events: [] } }));
      }
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
                trippedRates: {
                  checkerDisagreement: null,
                  unusable: null,
                  wrongAtHigh: null,
                },
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
        if (path === '/api/admin/ai-corrections/breaker/events') {
          return Promise.resolve(jsonResponse({ resource: { events: [] } }));
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
                  trippedRates: {
                    checkerDisagreement: null,
                    unusable: null,
                    wrongAtHigh: null,
                  },
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
      if (path === '/api/admin/ai-corrections/breaker/events') {
        return Promise.resolve(jsonResponse({ resource: { events: [] } }));
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
      if (path === '/api/admin/ai-corrections/breaker/events') {
        return Promise.resolve(jsonResponse({ resource: { events: [] } }));
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
          trippedRates: {
            checkerDisagreement: null,
            unusable: 0.24,
            wrongAtHigh: null,
          },
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
    // V4.5-193. L'écran affichait « Pas assez de données » sur les trois
    // règles dès que le coupe-circuit était verrouillé — précisément au
    // moment où le chiffre compte. Le serveur ne re-mesure pas une fenêtre
    // qui a bougé depuis, mais il a gardé le relevé du déclenchement : c'est
    // lui qu'on affiche, pour la règle qui a déclenché.
    expect(screen.getByText('24.0 %')).toBeInTheDocument();
    expect(screen.getAllByText('au déclenchement')).toHaveLength(1);
    // Les deux autres règles n'ont pas de relevé gelé. « Non mesuré depuis le
    // déclenchement » et « pas assez de données » ne disent pas la même
    // chose : la première décrit une mesure suspendue, la seconde une mesure
    // impossible.
    expect(
      screen.getAllByText('non mesuré depuis le déclenchement'),
    ).toHaveLength(2);
    expect(screen.queryByText('Pas assez de données')).not.toBeInTheDocument();

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
        trippedRates: {
          checkerDisagreement: null,
          unusable: null,
          wrongAtHigh: null,
        },
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
        if (path === '/api/admin/ai-corrections/breaker/events') {
          return Promise.resolve(jsonResponse({ resource: { events: [] } }));
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
                  trippedRates: {
                    checkerDisagreement: null,
                    unusable: null,
                    wrongAtHigh: null,
                  },
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

  /**
   * Remboursements (V4.5-162). Le montant n'est jamais saisi : il est calculé
   * par le serveur au prorata des crédits non consommés, et l'écran ne fait
   * que l'afficher avant de le faire confirmer.
   */
  function refundMock(options: {
    onRefund?: (init?: RequestInit) => Response | undefined;
    preview?: Record<string, unknown>;
  }) {
    const projection = {
      free: { available: '0', consumed: '0', expired: '0', reserved: '0' },
      purchased: {
        available: '40',
        consumed: '60',
        expired: '0',
        reserved: '0',
      },
      totalAvailable: '40',
      totalReserved: '0',
    };
    const member = {
      accountStatus: 'ACTIVE',
      displayName: 'Apprenant',
      email: 'learner@example.com',
      projection,
      userId: 'user-1',
    };
    const preview = options.preview ?? {
      computation: {
        expectedRemainingOnLot: '40',
        packCredits: '100',
        packPriceMinor: '1900',
        projectedWriteOffCredits: '0',
        reclaimedCredits: '40',
        refundedMinor: '760',
        remainingOnLot: '40',
      },
      order: {
        amountMinor: '1900',
        createdAt: '2026-08-01T10:00:00.000Z',
        currency: 'EUR',
        fulfilledAt: '2026-08-01T10:00:05.000Z',
        id: 'order-1',
        learner: {
          displayName: 'Apprenant',
          email: 'learner@example.com',
          userId: 'user-1',
        },
        packKey: 'pack-100',
        refundedCredits: '0',
        status: 'FULFILLED',
        writtenOffCredits: '0',
      },
      refundable: true,
      refusal: null,
    };

    return vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/admin/ai-corrections/breaker/events') {
        return Promise.resolve(jsonResponse({ resource: { events: [] } }));
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
                trippedRates: {
                  checkerDisagreement: null,
                  unusable: null,
                  wrongAtHigh: null,
                },
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
      if (path.includes('/orders')) {
        return Promise.resolve(
          jsonResponse({
            page: {
              items: [
                {
                  amountMinor: '1900',
                  createdAt: '2026-08-01T10:00:00.000Z',
                  currency: 'EUR',
                  fulfilledAt: '2026-08-01T10:00:05.000Z',
                  id: 'order-1',
                  packKey: 'pack-100',
                  refundedCredits: '0',
                  status: 'FULFILLED',
                  writtenOffCredits: '0',
                },
              ],
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          }),
        );
      }
      if (path.includes('/refund-preview')) {
        return Promise.resolve(jsonResponse({ resource: preview }));
      }
      if (path.endsWith('/refund')) {
        const response = options.onRefund?.(init);
        return Promise.resolve(
          response ?? jsonResponse({ resource: { refund: {} } }),
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
      if (path.startsWith('/api/admin/credits/members/')) {
        return Promise.resolve(
          jsonResponse({
            member: { ...member, history: [], pendingIncreaseRequest: null },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
  }

  async function openRefund() {
    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ajuster' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rembourser' }));
  }

  it('montre le calcul du serveur et n’offre aucune saisie de montant', async () => {
    vi.stubGlobal('fetch', refundMock({}));

    await openRefund();

    // 40 crédits non consommés sur un pack de 100 à 19,00 € : 7,60 €. Le
    // chiffre vient du serveur ; l'écran ne le recalcule pas.
    expect(await screen.findByText(/7,60/)).toBeInTheDocument();
    // Ciblé sur la ligne « Crédits repris » : « 40 » apparaît aussi dans le
    // solde du membre, et l'assertion doit porter sur le chiffre du calcul.
    expect(screen.getByText('Crédits repris').closest('div')).toHaveTextContent(
      '40',
    );

    // Dans la section remboursement, le seul champ est la note : le montant
    // n'y est saisissable nulle part. C'est la garde qui empêche qu'on
    // « corrige » un jour le calcul à la main. (Le tiroir contient par
    // ailleurs le formulaire d'ajustement, qui a son propre champ montant —
    // d'où la restriction à cette section.)
    const section = within(
      screen.getByRole('region', { name: 'Remboursement volontaire' }),
    );
    expect(section.getAllByRole('textbox')).toHaveLength(1);
    expect(
      section.getByRole('textbox', { name: /Note facultative/ }),
    ).toBeInTheDocument();
    expect(section.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('envoie le jeton de l’aperçu avec la confirmation', async () => {
    let sent: unknown;
    vi.stubGlobal(
      'fetch',
      refundMock({
        onRefund: (init) => {
          sent = JSON.parse(String(init?.body));
          return undefined;
        },
      }),
    );

    await openRefund();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmer le remboursement' }),
    );

    // Sans ce jeton, le serveur ne peut pas savoir que l'administrateur a
    // approuvé CE montant-là et pas un autre.
    await waitFor(() => expect(sent).toEqual({ expectedRemainingOnLot: '40' }));
  });

  it('ne prétend jamais avoir remboursé quand le solde a bougé entre les deux temps', async () => {
    vi.stubGlobal(
      'fetch',
      refundMock({
        onRefund: () =>
          jsonResponse(
            {
              error: {
                code: 'PAYMENT_REFUND_PREVIEW_STALE',
                message: 'Preview is stale.',
              },
            },
            409,
          ),
      }),
    );

    await openRefund();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmer le remboursement' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Rien n’a été remboursé/);
    expect(alert).toHaveTextContent(/calcul à jour/);
  });

  it('dit pourquoi un remboursement est refusé au lieu d’offrir zéro euro', async () => {
    vi.stubGlobal(
      'fetch',
      refundMock({
        preview: {
          computation: null,
          order: {
            amountMinor: '1900',
            createdAt: '2026-08-01T10:00:00.000Z',
            currency: 'EUR',
            fulfilledAt: '2026-08-01T10:00:05.000Z',
            id: 'order-1',
            learner: {
              displayName: 'Apprenant',
              email: 'learner@example.com',
              userId: 'user-1',
            },
            packKey: 'pack-100',
            refundedCredits: '0',
            status: 'DISPUTED',
            writtenOffCredits: '0',
          },
          refundable: false,
          refusal: { code: 'UNDER_DISPUTE', message: 'Dispute open.' },
        },
      }),
    );

    await openRefund();

    expect(await screen.findByText(/payer deux fois/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirmer le remboursement' }),
    ).not.toBeInTheDocument();
  });

  it('dit qu’un déclenchement n’a prévenu personne, au lieu de le noter en passant', async () => {
    // V4.5-193. Le coupe-circuit déclenche de façon durable AVANT que
    // quiconque soit prévenu : une panne du canal d'alerte ne peut pas
    // empêcher le verrouillage. La conséquence est qu'un déclenchement peut
    // être resté muet, et c'est la seule ligne du journal sur laquelle il
    // reste quelque chose à faire — donc elle est annoncée, pas journalisée.
    const events = [
      {
        actorId: null,
        actorName: null,
        alertError: 'SMTP timeout',
        alertedAt: null,
        at: '2026-08-29T14:31:00.000Z',
        id: 'event-1',
        kind: 'TRIPPED',
        note: null,
        rate: 0.24,
        reason: 'UNUSABLE_RATE',
        threshold: 0.05,
        windowSize: 50,
      },
      {
        actorId: 'user-admin',
        actorName: 'Rayan',
        alertError: null,
        alertedAt: null,
        at: '2026-08-28T09:00:00.000Z',
        id: 'event-0',
        kind: 'REOPENED',
        note: 'Faux positif après incident fournisseur.',
        rate: null,
        reason: null,
        threshold: null,
        windowSize: null,
      },
    ];

    const base = breakerMock({
      evaluationError: null,
      rates: { checkerDisagreement: null, unusable: null, wrongAtHigh: null },
      reason: null,
      state: 'CLOSED',
      thresholds: {
        checkerDisagreement: 0.4,
        unusable: 0.05,
        wrongAtHigh: 0.1,
      },
      trippedAt: null,
      trippedRates: {
        checkerDisagreement: null,
        unusable: null,
        wrongAtHigh: null,
      },
      window: { observed: 12, size: 50 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        if (path === '/api/admin/ai-corrections/breaker/events') {
          return Promise.resolve(jsonResponse({ resource: { events } }));
        }
        return base(path, init);
      }),
    );

    render(
      <AppProviders>
        <AdminCreditsPage />
      </AppProviders>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Propriétaire NON prévenu/);
    expect(alert).toHaveTextContent(/SMTP timeout/);
    // Le déclenchement lui-même reste vrai : l'alerte a échoué, pas le
    // garde-fou. L'écran doit dire les deux.
    expect(alert).toHaveTextContent(/Le coupe-circuit a bien déclenché/);

    expect(screen.getByText('24.0 % relevés, seuil 5 %')).toBeInTheDocument();
    expect(screen.getByText('par Rayan')).toBeInTheDocument();
    expect(
      screen.getByText('Faux positif après incident fournisseur.'),
    ).toBeInTheDocument();
  });
});
