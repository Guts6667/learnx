import { render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AdminCreditsPage } from '@/pages/AdminCreditsPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

describe('AdminCreditsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

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
});
