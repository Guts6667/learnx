import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AiCorrectionPanel } from '@/features/exercises/AiCorrectionPanel';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('AiCorrectionPanel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('demande un consentement explicite puis restitue seulement les critères fiables', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          resource: {
            quote: {
              action: 'STANDARD',
              estimatedCredits: '12',
              expiresAt: '2026-08-24T19:00:00.000Z',
              id: '89c42047-5133-4ef0-b2df-a6a39092f02f',
              includesAutomaticSecondPass: true,
              maximumReservedCredits: '18',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            resource: {
              correction: {
                correction: {
                  criteria: [
                    {
                      evidenceQuotes: ['La décision est explicitement PICO.'],
                      evidenceStatus: 'FOUND',
                      feedback: 'Le choix est explicite et cohérent.',
                      key: 'decision-explicite',
                      label: 'Décision explicite',
                      levelKey: 'mastered',
                      levelLabel: 'Maîtrisé',
                      weight: 35,
                    },
                  ],
                  id: 'a14cbe99-31dd-48f1-9fb3-4549a2d88bc2',
                  indicativeScore: null,
                  overallFeedback: 'Clarifiez maintenant la justification.',
                  secondPassRequired: true,
                  status: 'COMPLETED_PARTIAL',
                  unsureCriteria: ['justification-du-lien'],
                },
                replay: false,
                settlement: {
                  releasedCredits: '6',
                  reservedCredits: '18',
                  settledCredits: '12',
                },
              },
            },
          },
          201,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="0286768e-5b9c-491b-a4f4-f2e6863ef398" />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Voir le devis en crédits' }));
    expect(await screen.findByText(/Action : correction formative standard/)).toBeInTheDocument();
    expect(screen.getByText(/Certains critères peuvent revenir à retravailler sans compensation/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer et lancer la correction' }));

    expect(await screen.findByText('Décision explicite')).toBeInTheDocument();
    expect(screen.getByText('La décision est explicitement PICO.')).toBeInTheDocument();
    expect(screen.getByText(/justification-du-lien.*à retravailler/)).toBeInTheDocument();
    expect(screen.queryByText(/Score indicatif/)).not.toBeInTheDocument();
    expect(screen.getByText(/Plafond réservé : 18 · débité : 12 · libéré : 6/)).toBeInTheDocument();
  });

  it('permet de relancer la même exécution après une erreur réseau', async () => {
    const quote = {
      action: 'STANDARD',
      estimatedCredits: '12',
      expiresAt: '2026-08-24T19:00:00.000Z',
      id: '89c42047-5133-4ef0-b2df-a6a39092f02f',
      includesAutomaticSecondPass: true,
      maximumReservedCredits: '18',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resource: { quote } }))
      .mockRejectedValueOnce(new Error('Connexion interrompue'))
      .mockResolvedValueOnce(
        jsonResponse({
          resource: {
            correction: {
              correction: {
                criteria: [],
                id: 'a14cbe99-31dd-48f1-9fb3-4549a2d88bc2',
                indicativeScore: null,
                overallFeedback: null,
                secondPassRequired: false,
                status: 'FAILED',
                unsureCriteria: [],
              },
              replay: false,
              settlement: {
                releasedCredits: '6',
                reservedCredits: '18',
                settledCredits: '12',
              },
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="0286768e-5b9c-491b-a4f4-f2e6863ef398" />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Voir le devis en crédits' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer et lancer la correction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion interrompue');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/Le débit reste celui du devis accepté/)).toBeInTheDocument();
  });
});
