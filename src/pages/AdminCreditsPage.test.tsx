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
              completed: 0,
              hardConstraintLevelMismatchSuspected: 0,
              partial: 0,
              scoreGuardTriggered: 0,
              totalCorrections: 0,
              totalProviderCostUsd: '0.00000000',
              unavailable: 0,
              unknownCostAttempts: 0,
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
                completed: 8,
                hardConstraintLevelMismatchSuspected: 2,
                partial: 3,
                scoreGuardTriggered: 4,
                totalCorrections: 12,
                totalProviderCostUsd: '0.05200000',
                unavailable: 1,
                unknownCostAttempts: 0,
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
    expect(
      screen.getByText('Alertes contrainte dure non reflétée dans le niveau'),
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
                completed: 0,
                hardConstraintLevelMismatchSuspected: 0,
                partial: 0,
                scoreGuardTriggered: 0,
                totalCorrections: 0,
                totalProviderCostUsd: '0.00000000',
                unavailable: 0,
                unknownCostAttempts: 0,
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
        target: { value: 'Smoke V4-019 preview' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Vérifier le récapitulatif' }),
    );

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
