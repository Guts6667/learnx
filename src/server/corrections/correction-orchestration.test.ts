import { describe, expect, it, vi } from 'vitest';

import { correctionContractSchema } from '@/lib/ai-correction-contracts';
import { CorrectionModelOutputError } from '@/lib/ai-correction-provider-adapters';

import { CorrectionOrchestrationError } from './correction-orchestration';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';
import {
  type Harness,
  buildHarness,
  buildQuote,
  contractRaw,
  partialOutput,
  undeliverableCriterionOutput,
  strictOutput,
  strictOutputWithLevels,
} from './correction-orchestration.test-support';

describe('correction orchestration (V4-009)', () => {
  it('n’autorise qu’une seule reprise, et seulement sur une réponse inutilisable', () => {
    // owner-retry-policy-2026-08-29. One, not "some": a second retry would
    // pay a third time for a model that has already refused twice to satisfy
    // its own contract.
    expect(PROMOTED_CORRECTION_IDENTITY.maxRetries).toBe(1);
  });
  it('delivers a full correction, settles the full quote price and releases the ceiling difference', async () => {
    const harness = buildHarness({ transport: strictOutput });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.replay).toBe(false);
    expect(result.correction.status).toBe('COMPLETED');
    expect(result.correction.unsureCriteria).toEqual([]);
    expect(result.correction.unsureCriterionDetails).toEqual([]);
    expect(result.correction.indicativeScore).toBe(100);
    expect(result.correction.criteria).toHaveLength(2);
    expect(result.correction.criteria[0]).toMatchObject({
      key: 'decision-position',
      levelLabel: 'Maîtrisé',
      weight: 60,
    });
    expect(result.settlement).toEqual({
      releasedCredits: '6',
      reservedCredits: '18',
      settledCredits: '12',
    });
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
    expect(harness.corrections.persisted).toHaveLength(1);
    expect(harness.corrections.persisted[0]).toMatchObject({
      attempts: [
        {
          actualCostUsd: 0.014,
          providerRequestId: 'generation-1',
          sequence: 1,
          status: 'SUCCEEDED',
        },
      ],
    });
    expect(harness.transportOutputs).toHaveLength(1);
  });

  it.each([
    { decision: 'mastered' as const, evidence: 'partial' as const, raw: 80 },
    { decision: 'partial' as const, evidence: 'mastered' as const, raw: 70 },
  ])(
    'n’appelle plus le modèle deux fois près du seuil de réussite ($raw)',
    async ({ decision, evidence, raw }) => {
      // These two scores sit exactly on the old inclusive score-guard band and
      // used to trigger a second pass. V4.5-111 replaced that with one
      // independent check of the evidence: asking the same model again and
      // treating agreement as reassurance established nothing.
      expect(Math.abs(raw - contractRaw.passingScore)).toBe(5);
      const harness = buildHarness({
        transport: () => strictOutputWithLevels({ decision, evidence }),
      });

      const result = await harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      });

      expect(harness.transportOutputs).toHaveLength(1);
      expect(result.correction).toMatchObject({
        status: 'COMPLETED',
      });
      expect(result.correction.monitoringSignals).not.toContain(
        'SCORE_GUARD_TRIGGERED',
      );
    },
  );

  it('signale une contrainte dure mentionnée sans niveau plancher', async () => {
    const harness = buildHarness({
      transport: () => {
        const output = strictOutput();
        output.criteria['decision-position'].feedback =
          'La réponse viole une contrainte interdite mais reste exploitable.';
        return output;
      },
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.monitoringSignals).toContain(
      'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED',
    );
  });

  it('delivers the criterion whose quote was not in the answer, without a score, and still settles the full quote price', async () => {
    // V4.5-177. `partialOutput` cite « un chiffre inventé hors dossier » : une
    // preuve absente de la copie. Le critère n'est plus retiré de la
    // correction — le retirer ferait disparaître une note sans que l'apprenant
    // l'apprenne — il est livré sans extrait ni niveau montré.
    const harness = buildHarness({ transport: partialOutput });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED');
    expect(result.correction.unsureCriteria).toEqual([]);
    expect(result.correction.criteria.map((item) => item.key)).toEqual([
      'decision-position',
      'evidence-selection',
    ]);

    const withdrawn = result.correction.criteria.find(
      (item) => item.key === 'evidence-selection',
    );
    expect(withdrawn?.evidenceStatus).toBe('EVIDENCE_WITHDRAWN');
    expect(withdrawn?.evidenceQuotes).toEqual([]);
    // La citation retirée fait retomber le critère en LOW, et un seul LOW
    // retient le score : la note d'ensemble n'est pas publiée sur une preuve
    // qu'on vient d'écarter.
    expect(withdrawn?.confidence).toBe('LOW');
    expect(result.correction.indicativeScore).toBeNull();

    // Le prix ne bouge pas : la correction a bien été produite et livrée.
    expect(result.settlement.settledCredits).toBe('12');
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
  });

  it('delivers a partial correction without exact score and still settles the full quote price', async () => {
    // Une livraison partielle reste possible, mais pour un critère réellement
    // inexploitable — ici un niveau hors barème — et non pour une citation
    // dont la provenance est en cause.
    const harness = buildHarness({ transport: undeliverableCriterionOutput });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED_PARTIAL');
    expect(result.correction.unsureCriteria).toEqual(['evidence-selection']);
    expect(result.correction.unsureCriterionDetails).toEqual([
      { key: 'evidence-selection', label: 'Sélection des preuves' },
    ]);
    expect(result.correction.indicativeScore).toBeNull();
    expect(result.correction.criteria.map((item) => item.key)).toEqual([
      'decision-position',
    ]);
    expect(result.settlement.settledCredits).toBe('12');
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
  });

  it('records an honest unavailable state and releases the reservation when nothing is deliverable', async () => {
    const harness = buildHarness({ transport: () => 'not-json-structured' });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('FAILED');
    expect(result.correction.criteria).toEqual([]);
    // Charging the accepted price for a partial delivery is a consented
    // economic decision; charging for an empty result is a defect the learner
    // would be paying for.
    expect(result.settlement.settledCredits).toBe('0');
    expect(result.settlement.releasedCredits).toBe(
      result.settlement.reservedCredits,
    );
    expect(harness.credits.calls).toEqual(['reserve', 'release']);
  });

  it('preserves provider usage and generation metadata for a rejected model output', async () => {
    const harness = buildHarness({
      transport: () => {
        throw new CorrectionModelOutputError('MODEL_OUTPUT_TRUNCATED', {
          latencyMs: 2_100,
          modelSnapshot: PROMOTED_CORRECTION_IDENTITY.modelId,
          providerRequestId: 'generation-truncated',
          providerRoute: PROMOTED_CORRECTION_IDENTITY.provider,
          rawModelOutput: '{"partial":true}',
          usage: {
            actualCostUsd: 0.019,
            costSource: 'ACTUAL',
            inputTokens: 1_100,
            reasoningTokens: 0,
            visibleOutputTokens: 1_500,
          },
        });
      },
    });

    await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(harness.corrections.persisted[0]).toMatchObject({
      attempts: [
        {
          actualCostUsd: 0.019,
          errorCode: 'MODEL_OUTPUT_TRUNCATED',
          inputTokens: 1_100,
          output: '{"partial":true}',
          providerRequestId: 'generation-truncated',
          sequence: 1,
          status: 'FAILED',
          visibleOutputTokens: 1_500,
        },
      ],
    });
  });

  it('keeps an unknown provider cost explicit instead of reconstructing it as zero', async () => {
    const harness = buildHarness({
      transport: () => {
        throw new Error('NETWORK_OUTCOME_UNKNOWN');
      },
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction).toMatchObject({
      modelUsageCostUsd: null,
      status: 'FAILED',
    });
    expect(harness.corrections.attemptOutcomes).toEqual([
      expect.objectContaining({
        errorCode: 'NETWORK_OUTCOME_UNKNOWN',
        status: 'FAILED',
      }),
    ]);
    expect(harness.corrections.attemptOutcomes[0]).not.toHaveProperty(
      'actualCostUsd',
    );
  });

  it('replays an already orchestrated quote without touching credits again', async () => {
    const replay = {
      correction: {
        id: 'correction-existing',
        status: 'COMPLETED',
        criteria: [],
        unsureCriteria: [],
        overallFeedback: null,
        indicativeScore: 80,
        modelUsageCostUsd: 0.01,
        monitoringSignals: [],
      },
      settlement: {
        releasedCredits: '6',
        reservedCredits: '18',
        settledCredits: '12',
      },
      replay: true,
    };
    const harness = buildHarness({ transport: strictOutput, replay });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result).toEqual(replay);
    expect(harness.credits.calls).toEqual([]);
    expect(harness.corrections.persisted).toHaveLength(0);
  });

  it('completes a pending settlement on replay without calling the provider again', async () => {
    const replay = {
      correction: {
        criteria: [],
        id: 'correction-existing',
        indicativeScore: 80,
        modelUsageCostUsd: 0.01,
        monitoringSignals: [],
        overallConfidence: 'MEDIUM' as const,
        overallFeedback: null,
        status: 'COMPLETED' as const,
        unsureCriteria: [],
        unsureCriterionDetails: [],
      },
      replay: true,
      settlement: {
        releasedCredits: '6',
        reservedCredits: '18',
        settledCredits: '12',
      },
    };
    const harness = buildHarness({
      replayLookup: {
        reservationId: 'reservation-1',
        result: replay,
        state: 'READY_TO_SETTLE',
      },
      transport: strictOutput,
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result).toEqual(replay);
    expect(harness.credits.calls).toEqual(['settle']);
    expect(harness.transportOutputs).toEqual([]);
  });

  it('never charges a replayed correction that delivered nothing', async () => {
    const failed = {
      correction: {
        contractVersion: '1.0.0',
        criteria: [],
        id: 'correction-failed',
        indicativeScore: null,
        modelUsageCostUsd: 0.01,
        monitoringSignals: [],
        overallConfidence: 'LOW' as const,
        overallFeedback: null,
        status: 'FAILED' as const,
        unsureCriteria: [],
        unsureCriterionDetails: [],
      },
      replay: true,
      settlement: {
        releasedCredits: '6',
        reservedCredits: '18',
        settledCredits: '12',
      },
    };
    const harness = buildHarness({
      replayLookup: {
        reservationId: 'reservation-1',
        result: failed,
        state: 'READY_TO_SETTLE',
      },
      transport: strictOutput,
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    // The stored settlement figures came from before the doctrine changed, so
    // the replay must recompute them rather than echo what was persisted.
    expect(result.settlement.settledCredits).toBe('0');
    expect(result.settlement.releasedCredits).toBe(
      result.settlement.reservedCredits,
    );
    expect(result.replay).toBe(true);
    expect(harness.credits.calls).toEqual(['release']);
    expect(harness.transportOutputs).toEqual([]);
  });

  it('blocks a replay whose financial state requires reconciliation', async () => {
    const harness = buildHarness({
      replayLookup: { state: 'RECONCILIATION_REQUIRED' },
      transport: strictOutput,
    });

    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      code: 'FINANCIAL_RECONCILIATION_REQUIRED',
    });
    expect(harness.credits.calls).toEqual([]);
    expect(harness.transportOutputs).toEqual([]);
  });

  it('refuses an expired quote before any reservation', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.quotes.loadAcceptedQuote = (async () =>
      buildQuote({ expiresAt: new Date('2026-08-24T09:00:00Z') })) as never;
    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow(CorrectionOrchestrationError);
    expect(harness.credits.calls).toEqual([]);
  });

  it('accepts every owner-approved productive activity type', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.quotes.loadAcceptedQuote = (async () =>
      buildQuote({
        contract: {
          ...contractRaw,
          target: { ...contractRaw.target, activityType: 'practice' },
        },
      })) as never;

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED');
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
    expect(harness.transportOutputs).toHaveLength(1);
  });

  it.each([
    { language: 'en-GB' },
    { modelId: 'anthropic/another-model' },
    { provider: 'AnotherProvider' },
    { promptVersion: 'obsolete-prompt' },
    { includesAutomaticSecondPass: false },
  ])(
    'refuses a quote outside the promoted runtime identity: %o',
    async (override) => {
      const harness = buildHarness({ transport: strictOutput });
      harness.quotes.loadAcceptedQuote = (async () =>
        buildQuote(override)) as never;

      await expect(
        harness.service.runAcceptedQuote({
          quoteId: 'quote-1',
          userId: 'user-1',
        }),
      ).rejects.toMatchObject({ code: 'QUOTE_INCOMPATIBLE' });
      expect(harness.credits.calls).toEqual([]);
      expect(harness.transportOutputs).toEqual([]);
    },
  );

  it('reports insufficient credits without persisting a correction', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.credits.reserve = (async () => {
      harness.credits.calls.push('reserve');
      throw new Error('INSUFFICIENT_CREDITS');
    }) as never;
    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect(harness.corrections.persisted).toHaveLength(0);
    expect(harness.credits.calls).toEqual(['reserve']);
  });

  it('releases the reservation immediately when persistence fails', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.corrections.finalize = vi.fn(async () => {
      throw new Error('PERSISTENCE_FAILED');
    });

    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('PERSISTENCE_FAILED');

    expect(harness.transportOutputs).toHaveLength(1);
    expect(harness.credits.calls).toEqual(['reserve', 'release']);
  });

  it('reconciles instead of rewriting a successful provider call when outcome persistence fails', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.corrections.recordAttemptOutcome = vi.fn(async () => {
      throw new Error('ATTEMPT_OUTCOME_PERSISTENCE_FAILED');
    });

    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('ATTEMPT_OUTCOME_PERSISTENCE_FAILED');

    expect(harness.transportOutputs).toHaveLength(1);
    expect(
      harness.corrections.markReconciliationRequired,
    ).toHaveBeenCalledOnce();
    expect(harness.credits.calls).toEqual(['reserve', 'release']);
    expect(harness.corrections.finalize).not.toHaveBeenCalled();
  });

  it('persists call intent before provider dispatch and leaves a failed settlement replayable', async () => {
    const harness: Harness = buildHarness({
      beforeTransport: () => {
        expect(harness.corrections.attemptIntents).toHaveLength(1);
      },
      transport: strictOutput,
    });
    harness.credits.settle = vi.fn(async () => {
      harness.credits.calls.push('settle');
      throw new Error('SETTLEMENT_FAILED');
    });

    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('SETTLEMENT_FAILED');

    expect(
      harness.corrections.markReconciliationRequired,
    ).not.toHaveBeenCalled();
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
  });

  it('parses the runtime contract snapshot through the published contract schema', () => {
    expect(() => correctionContractSchema.parse(contractRaw)).not.toThrow();
    expect(PROMOTED_CORRECTION_IDENTITY).toMatchObject({
      activityTypeScope: ['writing', 'reflection', 'practice', 'project'],
      scientificallyValidatedActivityTypeScope: ['writing'],
      languageScope: ['fr-FR'],
      maxRetries: 1,
      scoreGuardBandPoints: 5,
      targetKindScope: ['EXERCISE'],
    });
  });
});
