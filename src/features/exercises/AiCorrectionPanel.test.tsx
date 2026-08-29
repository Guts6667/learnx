import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    expect(
      screen.getByText('Coût estimé en crédits').closest('div'),
    ).toHaveTextContent('12');
    expect(
      screen.getByText('Plafond réservé en crédits').closest('div'),
    ).toHaveTextContent('18');
    expect(screen.getByText('Vérification').closest('div')).toHaveTextContent(
      'Incluse',
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === '/api/ai-corrections' && init?.method === 'POST',
      ),
    ).toBe(false);

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
      await screen.findByText(/réservation de crédits a été libérée/),
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
    expect(argument).toHaveAttribute('minlength', '20');
    expect(argument).toHaveAttribute('maxlength', '500');
    expect(argument).toHaveAccessibleDescription(/0\/500/);
    const quoteButton = screen.getByRole('button', {
      name: 'Obtenir le devis de réexamen',
    });
    expect(argument).toHaveAttribute('minlength', '20');
    expect(argument).toHaveAttribute('maxlength', '500');
    expect(quoteButton).toBeDisabled();

    fireEvent.input(argument, {
      target: { value: 'a'.repeat(19) },
    });
    expect(quoteButton).toBeDisabled();

    fireEvent.input(argument, {
      target: { value: 'a'.repeat(20) },
    });
    expect(quoteButton).toBeEnabled();

    fireEvent.input(argument, {
      target: { value: 'a'.repeat(500) },
    });
    expect(quoteButton).toBeEnabled();

    fireEvent.input(argument, {
      target: { value: 'a'.repeat(501) },
    });
    expect(quoteButton).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.input(argument, {
      target: {
        value:
          'La phrase citée répond entièrement au critère de justification.',
      },
    });
    expect(argument).toHaveAccessibleDescription(/63\/500/);
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

  it.each([
    ['practice' as const],
    ['project' as const],
    ['reflection' as const],
  ])(
    'annonce la phase de collecte avant tout lancement pour la famille %s',
    async (family) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ resource: { corrections: [] } }));
      vi.stubGlobal('fetch', fetchMock);

      render(
        <AppProviders>
          <AiCorrectionPanel
            submissionId="7bd1e5a6-1f6c-4a2e-9c1e-1a1f4f4a2e10"
            validationScope={{ family, validated: false }}
          />
        </AppProviders>,
      );

      expect(
        await screen.findByText(
          'Correction en phase de collecte — fiabilité non démontrée',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/n’est pas encore démontrée pour ce type d’exercice/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Corriger' }),
      ).toBeInTheDocument();
    },
  );

  it('n’annonce rien quand la famille est validée', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ resource: { corrections: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel
          submissionId="7bd1e5a6-1f6c-4a2e-9c1e-1a1f4f4a2e11"
          validationScope={{ family: 'writing', validated: true }}
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('button', { name: 'Corriger' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Correction en phase de collecte — fiabilité non démontrée',
      ),
    ).not.toBeInTheDocument();
  });

  it('n’annonce rien quand l’API n’expose pas encore le périmètre', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ resource: { corrections: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="7bd1e5a6-1f6c-4a2e-9c1e-1a1f4f4a2e12" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('button', { name: 'Corriger' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Correction en phase de collecte — fiabilité non démontrée',
      ),
    ).not.toBeInTheDocument();
  });
  it('rend un critère en confiance basse sans niveau ni retour prescriptif', async () => {
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
              includesAutomaticSecondPass: false,
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
                      confidence: 'MEDIUM',
                      evidenceQuotes: ['La décision est explicitement PICO.'],
                      evidenceStatus: 'FOUND',
                      feedback: 'Le choix est explicite et cohérent.',
                      key: 'decision-explicite',
                      label: 'Décision explicite',
                      levelKey: 'mastered',
                      levelLabel: 'Démontré dans la réponse',
                      weight: 34,
                    },
                    {
                      confidence: 'LOW',
                      evidenceQuotes: ['je laisse ouvert le volet comparaison'],
                      evidenceStatus: 'FOUND',
                      feedback: 'RETOUR PRESCRIPTIF À NE PAS AFFICHER.',
                      key: 'choice-rationale',
                      label: 'Justification du lien',
                      levelKey: 'partial',
                      levelLabel: 'Partiel',
                      weight: 33,
                    },
                  ],
                  id: 'a14cbe99-31dd-48f1-9fb3-4549a2d88bc2',
                  indicativeScore: null,
                  overallConfidence: 'LOW',
                  overallFeedback: 'Clarifiez la justification.',
                  status: 'COMPLETED',
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
          },
          201,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ resource: { corrections: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AiCorrectionPanel submissionId="1f0f6f6a-1d5c-4f2e-9a44-9c1f3f5b7d21" />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Corriger' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Confirmer et lancer la correction',
      }),
    );

    // Le critère MEDIUM garde son niveau : la confiance moyenne ne se dit pas.
    expect(await screen.findByText('Décision explicite')).toBeInTheDocument();
    expect(screen.getByText('Démontré dans la réponse')).toBeInTheDocument();

    // Le critère LOW perd son niveau et gagne « À vérifier ».
    const lowCriterion = screen
      .getByText('Justification du lien')
      .closest('article');
    expect(lowCriterion).toHaveClass('correction-criterion--unsure');
    expect(lowCriterion).toHaveTextContent('À vérifier');
    expect(lowCriterion).not.toHaveTextContent('Partiel');

    // Le retour du modèle sur ce critère n'est jamais présenté comme une consigne.
    expect(
      screen.queryByText('RETOUR PRESCRIPTIF À NE PAS AFFICHER.'),
    ).not.toBeInTheDocument();

    // La preuve verbatim reste affichée : c'est ce que l'apprenant a écrit.
    expect(lowCriterion).toHaveTextContent(
      'je laisse ouvert le volet comparaison',
    );

    // L'absence de score est expliquée, pas laissée vide.
    expect(
      screen.getByText(
        /Aucun score indicatif tant qu’un critère reste à vérifier/,
      ),
    ).toBeInTheDocument();
  });
});
