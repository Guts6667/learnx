import { describe, expect, it, vi } from 'vitest';

import { correctionContractSchema } from '@/lib/ai-correction-contracts';

import {
  CorrectionOrchestrationError,
  CorrectionOrchestrationService,
  type AcceptedQuoteSnapshot,
  type CorrectionTransportPort,
} from './correction-orchestration';

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

function buildQuote(overrides: Partial<AcceptedQuoteSnapshot> = {}): AcceptedQuoteSnapshot {
  return {
    quoteId: 'quote-1',
    userId: 'user-1',
    target: { id: 'submission-1', kind: 'EXERCISE_SUBMISSION' },
    estimatedCredits: 12n,
    maximumReservedCredits: 18n,
    expiresAt: new Date('2026-08-24T12:00:00Z'),
    promptVersion: '2.2.0',
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
    persisted: unknown[];
    findByQuote: (input: unknown) => Promise<unknown>;
    persist: (input: unknown) => Promise<{ id: string }>;
  };
  transportOutputs: unknown[];
}

function buildHarness(options: {
  transport: () => unknown;
  replay?: unknown;
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
    persisted: [] as unknown[],
    findByQuote: vi.fn(
      async () =>
        (options.replay ?? null) as
          | import('./correction-orchestration').OrchestratedCorrectionResult
          | null,
    ),
    persist: vi.fn(async (input: unknown) => {
      corrections.persisted.push(input);
      return { id: `correction-${corrections.persisted.length}` };
    }),
  };
  const transportOutputs: unknown[] = [];
  const transport: CorrectionTransportPort = {
    execute: vi.fn(async () => {
      transportOutputs.push(options.transport());
      return {
        latencyMs: 1200,
        output: transportOutputs[transportOutputs.length - 1],
        usage: { actualCostUsd: 0.014, inputTokens: 900, reasoningTokens: 0, visibleOutputTokens: 320 },
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
    expect(harness.credits.calls).toEqual(['reserve', 'settle', 'release']);
    expect(harness.corrections.persisted).toHaveLength(1);
  });

  it('delivers a partial correction without exact score and still settles the full quote price', async () => {
    const harness = buildHarness({ transport: partialOutput });
    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED_PARTIAL');
    expect(result.correction.unsureCriteria).toEqual(['evidence-selection']);
    expect(result.correction.indicativeScore).toBeNull();
    expect(result.correction.criteria.map((item) => item.key)).toEqual([
      'decision-position',
    ]);
    expect(result.settlement.settledCredits).toBe('12');
    expect(harness.credits.calls).toEqual(['reserve', 'settle', 'release']);
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
    expect(harness.credits.calls).toEqual(['reserve', 'settle', 'release']);
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

  it('refuses an expired quote before any reservation', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.quotes.loadAcceptedQuote = (async () =>
      buildQuote({ expiresAt: new Date('2026-08-24T09:00:00Z') })) as never;
    await expect(
      harness.service.runAcceptedQuote({ quoteId: 'quote-1', userId: 'user-1' }),
    ).rejects.toThrow(CorrectionOrchestrationError);
    expect(harness.credits.calls).toEqual([]);
  });

  it('reports insufficient credits without persisting a correction', async () => {
    const harness = buildHarness({ transport: strictOutput });
    harness.credits.reserve = (async () => {
      harness.credits.calls.push('reserve');
      throw new Error('INSUFFICIENT_CREDITS');
    }) as never;
    await expect(
      harness.service.runAcceptedQuote({ quoteId: 'quote-1', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    expect(harness.corrections.persisted).toHaveLength(0);
    expect(harness.credits.calls).toEqual(['reserve']);
  });

  it('parses the runtime contract snapshot through the published contract schema', () => {
    expect(() => correctionContractSchema.parse(contractRaw)).not.toThrow();
  });
});
