import { vi } from 'vitest';

import {
  CorrectionOrchestrationService,
  type AcceptedQuoteSnapshot,
  type CorrectionTransportPort,
  type PersistedCorrectionLookup,
  type RuntimeCorrectionAttempt,
} from './correction-orchestration';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';

export const contractRaw = {
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

export function buildQuote(
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

export function strictOutput() {
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

export function partialOutput() {
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

export function strictOutputWithLevels(input: {
  decision: 'insufficient' | 'partial' | 'mastered';
  evidence: 'insufficient' | 'partial' | 'mastered';
}) {
  const output = strictOutput();
  output.criteria['decision-position'].levelKey = input.decision;
  output.criteria['evidence-selection'].levelKey = input.evidence;
  return output;
}

export interface Harness {
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
  transport: CorrectionTransportPort;
  transportOutputs: unknown[];
}

export function buildHarness(options: {
  beforeTransport?: () => void;
  checker?: {
    verify(input: unknown): Promise<unknown>;
  };
  quote?: AcceptedQuoteSnapshot;
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
    recordAttemptOutcome: vi.fn(
      async (input: {
        attempt: RuntimeCorrectionAttempt;
        correctionId: string;
      }) => {
        corrections.attemptOutcomes.push(input.attempt);
      },
    ),
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
    loadAcceptedQuote: vi.fn(async () => options.quote ?? buildQuote()),
    markConsumed: vi.fn(async () => undefined),
  };
  const service = new CorrectionOrchestrationService(
    quotes,
    credits,
    corrections,
    transport,
    {
      apiKey: 'test-key',
      ...(options.checker
        ? {
            checker:
              options.checker as unknown as import('./correction-checker').CorrectionCheckerPort,
          }
        : {}),
      now: () => new Date('2026-08-24T10:00:00Z'),
    },
  );
  return { service, quotes, credits, corrections, transport, transportOutputs };
}
