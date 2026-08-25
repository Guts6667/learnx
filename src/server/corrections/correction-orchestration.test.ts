import { describe, expect, it, vi } from 'vitest';

import { correctionContractSchema } from '@/lib/ai-correction-contracts';
import { CorrectionModelOutputError } from '@/lib/ai-correction-provider-adapters';

import {
  CorrectionOrchestrationError,
  CorrectionOrchestrationService,
  type AcceptedQuoteSnapshot,
  type CorrectionTransportPort,
  type PersistedCorrectionLookup,
  type RuntimeCorrectionAttempt,
} from './correction-orchestration';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';

const contractRaw = {
  schemaVersion: 1,
  contractKey: 'runtime-writing-decision',
  version: '1.0.0',
  target: {
    kind: 'EXERCISE',
    activityKey: 'runtime-writing-decision',
    activityType: 'writing',
  },
  lifecycle: { status: 'PUBLISHED', publishedAt: '2026-08-24T00:00:00+02:00' },
  objectives: ['Trancher avec preuves exactes.'],
  evidence: { primaryKind: 'TEXT', acceptedKinds: ['TEXT'] },
  authorizedReferences: [],
  passingScore: 75,
  secondPass: {
    enabled: true,
    confidenceThreshold: 0.65,
    maxPasses: 2,
    triggers: ['LOW_CONFIDENCE', 'CRITERION_DISAGREEMENT'],
  },
  criteria: [
    {
      key: 'decision-position',
      label: 'Position décisionnelle',
      objective: 'Formuler une décision applicable.',
      weight: 60,
      expectedElements: ['Une option choisie explicitement.'],
      acceptableVariants: ['Une décision conditionnelle observable.'],
      commonErrors: ['Reporter le choix.'],
      calibratedExamples: [
        {
          expectedLevelKey: 'mastered',
          responseExcerpt: 'Je retiens l’option locale.',
          rationale: 'Décision exploitable.',
        },
      ],
      performanceLevels: [
        {
          key: 'insufficient',
          label: 'Insuffisant',
          score: 0,
          description: 'Aucune position identifiable.',
        },
        {
          key: 'partial',
          label: 'Partiel',
          score: 50,
          description: 'Orientation équivoque.',
        },
        {
          key: 'mastered',
          label: 'Maîtrisé',
          score: 100,
          description: 'Position explicite et actionnable.',
        },
      ],
    },
    {
      key: 'evidence-selection',
      label: 'Sélection des preuves',
      objective: 'Citer les faits décisifs exactement.',
      weight: 40,
      expectedElements: ['Faits du dossier repris tels quels.'],
      acceptableVariants: ['Paraphrase stricte acceptable.'],
      commonErrors: ['Inventer un chiffre.'],
      calibratedExamples: [
        {
          expectedLevelKey: 'partial',
          responseExcerpt: 'Le délai a baissé, semble-t-il.',
          rationale: 'Fait évoqué sans exactitude.',
        },
      ],
      performanceLevels: [
        {
          key: 'insufficient',
          label: 'Insuffisant',
          score: 0,
          description: 'Aucun fait du dossier.',
        },
        {
          key: 'partial',
          label: 'Partiel',
          score: 50,
          description: 'Faits imprécis.',
        },
        {
          key: 'mastered',
          label: 'Maîtrisé',
          score: 100,
          description: 'Faits exacts et décisifs.',
        },
      ],
    },
  ],
};

const SUBMISSION_TEXT =
  'Je retiens l’option locale ce trimestre. Le délai médian est passé de 18 à 13 heures selon le dossier.';

function buildQuote(
  overrides: Partial<AcceptedQuoteSnapshot> = {},
): AcceptedQuoteSnapshot {
  return {
    quoteId: 'quote-1',
    userId: 'user-1',
    target: { id: 'submission-1', kind: 'EXERCISE_SUBMISSION' },
    language: 'fr-FR',
    estimatedCredits: 12n,
    maximumReservedCredits: 18n,
    expiresAt: new Date('2026-08-24T12:00:00Z'),
    promptVersion: '2.2.0',
    modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
    provider: PROMOTED_CORRECTION_IDENTITY.provider,
    includesAutomaticSecondPass: true,
    contractKey: contractRaw.contractKey,
    contractVersion: contractRaw.version,
    requestFingerprint: 'a'.repeat(64),
    submissionText: SUBMISSION_TEXT,
    exerciseInstructions: 'Rédige une note de décision.',
    taskContext: 'Dossier : délai 18 → 13 heures.',
    contract: contractRaw,
    ...overrides,
  };
}

function strictOutput() {
  return {
    criteria: {
      'decision-position': {
        confidence: 0.95,
        evidenceQuotes: ['Je retiens l’option locale ce trimestre.'],
        evidenceStatus: 'FOUND',
        feedback: 'La décision est explicite et applicable.',
        levelKey: 'mastered',
      },
      'evidence-selection': {
        confidence: 0.9,
        evidenceQuotes: ['Le délai médian est passé de 18 à 13 heures'],
        evidenceStatus: 'FOUND',
        feedback: 'Les deux chiffres décisifs sont exacts.',
        levelKey: 'mastered',
      },
    },
    overallFeedback: 'Note claire et étayée.',
  };
}

function partialOutput() {
  return {
    criteria: {
      'decision-position': {
        confidence: 0.95,
        evidenceQuotes: ['Je retiens l’option locale ce trimestre.'],
        evidenceStatus: 'FOUND',
        feedback: 'La décision est explicite et applicable.',
        levelKey: 'mastered',
      },
      'evidence-selection': {
        confidence: 0.4,
        evidenceQuotes: ['un chiffre inventé hors dossier'],
        evidenceStatus: 'FOUND',
        feedback: 'Les preuves ne sont pas vérifiables.',
        levelKey: 'insufficient',
      },
    },
    overallFeedback: 'Note claire ; preuve à retravailler.',
  };
}

function strictOutputWithLevels(input: {
  decision: 'insufficient' | 'partial' | 'mastered';
  evidence: 'insufficient' | 'partial' | 'mastered';
}) {
  const output = strictOutput();
  output.criteria['decision-position'].levelKey = input.decision;
  output.criteria['evidence-selection'].levelKey = input.evidence;
  return output;
}

interface Harness {
  service: CorrectionOrchestrationService;
  quotes: {
    loadAcceptedQuote: (
      input: unknown,
    ) => Promise<AcceptedQuoteSnapshot | null>;
    markConsumed: (input: { quoteId: string }) => Promise<void>;
  };
  credits: {
    calls: string[];
    reserve: (input: unknown) => Promise<{ reservationId: string }>;
    settle: (input: unknown) => Promise<void>;
    release: (input: unknown) => Promise<void>;
  };
  corrections: {
    attemptIntents: unknown[];
    attemptOutcomes: RuntimeCorrectionAttempt[];
    begin: (
      input: unknown,
    ) => Promise<{ correctionId: string; created: boolean }>;
    finalize: (input: unknown) => Promise<void>;
    persisted: unknown[];
    findByQuote: (input: unknown) => Promise<unknown>;
    markReconciliationRequired: (input: unknown) => Promise<void>;
    recordAttemptIntent: (input: unknown) => Promise<void>;
    recordAttemptOutcome: (input: {
      attempt: RuntimeCorrectionAttempt;
      correctionId: string;
    }) => Promise<void>;
  };
  transportOutputs: unknown[];
}

function buildHarness(options: {
  beforeTransport?: () => void;
  transport: () => unknown;
  replay?: unknown;
  replayLookup?: PersistedCorrectionLookup;
}): Harness {
  const credits = {
    calls: [] as string[],
    reserve: vi.fn(async () => {
      credits.calls.push('reserve');
      return { reservationId: 'reservation-1' };
    }),
    settle: vi.fn(async () => {
      credits.calls.push('settle');
    }),
    release: vi.fn(async () => {
      credits.calls.push('release');
    }),
  };
  const corrections = {
    attemptIntents: [] as unknown[],
    attemptOutcomes: [] as RuntimeCorrectionAttempt[],
    begin: vi.fn(async () => ({ correctionId: 'correction-1', created: true })),
    finalize: vi.fn(async (input: unknown) => {
      corrections.persisted.push({
        ...(input as Record<string, unknown>),
        attempts: [...corrections.attemptOutcomes],
      });
    }),
    persisted: [] as unknown[],
    findByQuote: vi.fn(
      async () =>
        options.replayLookup ??
        (options.replay
          ? {
              result:
                options.replay as import('./correction-orchestration').OrchestratedCorrectionResult,
              state: 'READY' as const,
            }
          : null),
    ),
    markReconciliationRequired: vi.fn(async () => undefined),
    recordAttemptIntent: vi.fn(async (input: unknown) => {
      corrections.attemptIntents.push(input);
    }),
    recordAttemptOutcome: vi.fn(async (input: {
      attempt: RuntimeCorrectionAttempt;
      correctionId: string;
    }) => {
      corrections.attemptOutcomes.push(input.attempt);
    }),
  };
  const transportOutputs: unknown[] = [];
  const transport: CorrectionTransportPort = {
    execute: vi.fn(async () => {
      options.beforeTransport?.();
      transportOutputs.push(options.transport());
      return {
        latencyMs: 1200,
        modelSnapshot: PROMOTED_CORRECTION_IDENTITY.modelId,
        output: transportOutputs[transportOutputs.length - 1],
        providerRequestId: `generation-${transportOutputs.length}`,
        providerRoute: PROMOTED_CORRECTION_IDENTITY.provider,
        usage: {
          actualCostUsd: 0.014,
          inputTokens: 900,
          reasoningTokens: 0,
          visibleOutputTokens: 320,
        },
      };
    }),
  };
  const quotes = {
    loadAcceptedQuote: vi.fn(async () => buildQuote()),
    markConsumed: vi.fn(async () => undefined),
  };
  const service = new CorrectionOrchestrationService(
    quotes,
    credits,
    corrections,
    transport,
    { apiKey: 'test-key', now: () => new Date('2026-08-24T10:00:00Z') },
  );
  return { service, quotes, credits, corrections, transportOutputs };
}

describe('correction orchestration (V4-009)', () => {
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
    {
      decision: 'mastered' as const,
      evidence: 'partial' as const,
      expectedRawScore: 80,
    },
    {
      decision: 'partial' as const,
      evidence: 'mastered' as const,
      expectedRawScore: 70,
    },
  ])(
    'runs a second pass on the inclusive score-guard boundary ($expectedRawScore)',
    async ({ decision, evidence, expectedRawScore }) => {
      expect(Math.abs(expectedRawScore - contractRaw.passingScore)).toBe(
        PROMOTED_CORRECTION_IDENTITY.scoreGuardBandPoints,
      );
      const harness = buildHarness({
        transport: () => strictOutputWithLevels({ decision, evidence }),
      });

      const result = await harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      });

      expect(result.correction).toMatchObject({
        indicativeScore: null,
        modelUsageCostUsd: 0.028,
        monitoringSignals: ['SCORE_GUARD_TRIGGERED'],
        secondPassRequired: true,
        status: 'COMPLETED_PARTIAL',
      });
      expect(harness.transportOutputs).toHaveLength(2);
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

  it('publishes only criteria whose levels agree across the two passes', async () => {
    const outputs = [
      strictOutputWithLevels({ decision: 'mastered', evidence: 'partial' }),
      strictOutputWithLevels({ decision: 'mastered', evidence: 'mastered' }),
    ];
    let callIndex = 0;
    const harness = buildHarness({
      transport: () => outputs[callIndex++] ?? outputs[1],
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction).toMatchObject({
      indicativeScore: null,
      secondPassRequired: true,
      status: 'COMPLETED_PARTIAL',
      unsureCriteria: ['evidence-selection'],
    });
    expect(
      result.correction.criteria.map((criterion) => criterion.key),
    ).toEqual(['decision-position']);
    expect(result.correction.overallFeedback).toContain(
      'Certaines parties concordent',
    );
    expect(harness.transportOutputs).toHaveLength(2);
  });

  it('delivers a partial correction without exact score and still settles the full quote price', async () => {
    const harness = buildHarness({ transport: partialOutput });
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

  it('records an honest unavailable state and still settles the full quote when nothing is deliverable', async () => {
    const harness = buildHarness({ transport: () => 'not-json-structured' });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('FAILED');
    expect(result.correction.criteria).toEqual([]);
    expect(result.settlement.settledCredits).toBe('12');
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
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
        secondPassRequired: false,
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
        overallFeedback: null,
        secondPassRequired: false,
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

  it('refuses a non-writing contract before replay, reservation and transport', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.quotes.loadAcceptedQuote = (async () =>
      buildQuote({
        contract: {
          ...contractRaw,
          target: { ...contractRaw.target, activityType: 'practice' },
        },
      })) as never;

    await expect(
      harness.service.runAcceptedQuote({
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'QUOTE_INCOMPATIBLE' });
    expect(harness.credits.calls).toEqual([]);
    expect(harness.corrections.findByQuote).not.toHaveBeenCalled();
    expect(harness.transportOutputs).toEqual([]);
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
      activityTypeScope: ['writing'],
      languageScope: ['fr-FR'],
      maxRetries: 0,
      scoreGuardBandPoints: 5,
      targetKindScope: ['EXERCISE'],
    });
  });
});
