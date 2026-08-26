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
      .mockResolvedValueOnce(jsonResponse({ resource: { corrections: [] } }))
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
                  unsureCriterionDetails: [
                    {
                      key: 'justification-du-lien',
                      label: 'Justification du lien',
                    },
                  ],
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
      )
      .mockResolvedValueOnce(jsonResponse({ resource: { corrections: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="0286768e-5b9c-491b-a4f4-f2e6863ef398" />
      </AppProviders>,
    );

    await screen.findByRole('button', { name: 'Corriger' });
    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }));
    expect(
      await screen.findByText(/Action : correction formative standard/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Certains critères peuvent revenir à retravailler sans compensation/,
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer et lancer la correction' }),
    );

    expect(await screen.findByText('Décision explicite')).toBeInTheDocument();
    expect(
      screen.getByText('La décision est explicitement PICO.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Justification du lien.*à retravailler/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Score indicatif/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Plafond réservé : 18 · débité : 12 · libéré : 6/),
    ).toBeInTheDocument();
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
      .mockResolvedValueOnce(jsonResponse({ resource: { corrections: [] } }))
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
                unsureCriterionDetails: [],
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
      )
      .mockResolvedValueOnce(jsonResponse({ resource: { corrections: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="0286768e-5b9c-491b-a4f4-f2e6863ef398" />
      </AppProviders>,
    );

    await screen.findByRole('button', { name: 'Corriger' });
    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Confirmer et lancer la correction',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connexion interrompue',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(
      await screen.findByText(/Le débit reste celui du devis accepté/),
    ).toBeInTheDocument();
  });

  it('restaure une correction réglée sans proposer un nouveau devis', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        resource: {
          corrections: [
            {
              createdAt: '2026-08-24T19:00:00.000Z',
              correction: {
                criteria: [
                  {
                    evidenceQuotes: ['Je compare deux contraintes.'],
                    evidenceStatus: 'FOUND',
                    feedback: 'Le lien est explicite.',
                    key: 'context-fidelity',
                    label: 'Fidélité au contexte',
                    levelKey: 'mastered',
                    levelLabel: 'Maîtrisé',
                    weight: 33,
                  },
                ],
                id: 'a14cbe99-31dd-48f1-9fb3-4549a2d88bc2',
                indicativeScore: 100,
                overallFeedback: 'Réponse étayée.',
                secondPassRequired: false,
                status: 'COMPLETED',
                unsureCriteria: [],
                unsureCriterionDetails: [],
              },
              replay: true,
              settlement: {
                releasedCredits: '6',
                reservedCredits: '18',
                settledCredits: '12',
              },
            },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="0286768e-5b9c-491b-a4f4-f2e6863ef398" />
      </AppProviders>,
    );

    expect(await screen.findByText('Fidélité au contexte')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Corriger' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('permet de consulter deux corrections et compare leurs niveaux critériels', async () => {
    const correction = (
      id: string,
      levelKey: string,
      levelLabel: string,
      createdAt: string,
    ) => ({
      correction: {
        criteria: [
          {
            evidenceQuotes: ['Je relie le choix aux contraintes.'],
            evidenceStatus: 'FOUND',
            feedback: 'Le lien est documenté.',
            key: 'justification-du-lien',
            label: 'Justification du lien',
            levelKey,
            levelLabel,
            weight: 33,
          },
        ],
        id,
        indicativeScore: null,
        overallFeedback: 'Poursuivez la justification.',
        secondPassRequired: false,
        status: 'COMPLETED',
        unsureCriteria: [],
        unsureCriterionDetails: [],
      },
      createdAt,
      replay: true,
      settlement: {
        releasedCredits: '6',
        reservedCredits: '18',
        settledCredits: '12',
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        resource: {
          corrections: [
            correction(
              'a14cbe99-31dd-48f1-9fb3-4549a2d88bc2',
              'partial',
              'Partiel',
              '2026-08-24T19:00:00.000Z',
            ),
            correction(
              '3fb16723-221f-4e1c-841a-9d819ec82854',
              'mastered',
              'Maîtrisé',
              '2026-08-25T19:00:00.000Z',
            ),
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="0286768e-5b9c-491b-a4f4-f2e6863ef398" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Historique des corrections',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Partiel → Maîtrisé')).toBeInTheDocument();

    const firstCorrection = screen.getByRole('button', {
      name: /Correction 1/,
    });
    fireEvent.click(firstCorrection);

    expect(firstCorrection).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Partiel → Maîtrisé')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('demande un argument borné puis un devis distinct avant un unique réexamen', async () => {
    const submissionId = '0286768e-5b9c-491b-a4f4-f2e6863ef398';
    const sourceCorrectionId = 'a14cbe99-31dd-48f1-9fb3-4549a2d88bc2';
    const source = {
      action: 'STANDARD',
      correction: {
        criteria: [],
        id: sourceCorrectionId,
        indicativeScore: 50,
        overallFeedback: 'Le lien reste partiel.',
        secondPassRequired: false,
        status: 'COMPLETED',
        unsureCriteria: [],
        unsureCriterionDetails: [],
      },
      createdAt: '2026-08-24T19:00:00.000Z',
      replay: true,
      settlement: {
        releasedCredits: '3',
        reservedCredits: '6',
        settledCredits: '3',
      },
      sourceCorrectionId: null,
    };
    const reconsideration = {
      ...source,
      action: 'RECONSIDERATION',
      correction: {
        ...source.correction,
        id: '3fb16723-221f-4e1c-841a-9d819ec82854',
        indicativeScore: 100,
        overallFeedback: 'Le lien est confirmé.',
      },
      createdAt: '2026-08-26T19:00:00.000Z',
      sourceCorrectionId,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ resource: { corrections: [source] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          resource: {
            quote: {
              action: 'RECONSIDERATION',
              estimatedCredits: '3',
              expiresAt: '2026-08-26T19:00:00.000Z',
              id: '89c42047-5133-4ef0-b2df-a6a39092f02f',
              includesAutomaticSecondPass: true,
              maximumReservedCredits: '6',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            resource: {
              correction: {
                correction: reconsideration.correction,
                replay: false,
                settlement: reconsideration.settlement,
              },
            },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          resource: { corrections: [source, reconsideration] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId={submissionId} />
      </AppProviders>,
    );

    const argument = await screen.findByLabelText('Votre argument');
    const quoteButton = screen.getByRole('button', {
      name: 'Obtenir le devis de réexamen',
    });
    expect(quoteButton).toBeDisabled();

    fireEvent.input(argument, {
      target: {
        value:
          'La phrase citée répond entièrement au critère de justification.',
      },
    });
    expect(quoteButton).toBeEnabled();
    fireEvent.click(quoteButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const quoteRequest = fetchMock.mock.calls[1];
    expect(quoteRequest?.[0]).toBe('/api/ai-correction/quotes');
    expect(JSON.parse(String(quoteRequest?.[1]?.body))).toMatchObject({
      action: 'RECONSIDERATION',
      target: {
        id: submissionId,
        reconsideration: {
          sourceCorrectionId,
        },
      },
    });

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Confirmer et lancer le réexamen',
      }),
    );

    expect(await screen.findByText(/Réexamen/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Obtenir le devis de réexamen' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
