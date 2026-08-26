import type { MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';

import {
  resolveExerciseCorrectionContract,
  type ProductiveExerciseActivityType,
} from '../src/lib/exercise-correction-contracts';
import type { CorrectionContract } from '../src/lib/ai-correction-contracts';
import type { AuthEnvironment } from '../src/server/api/_lib/auth';
import { createAiPricingApp } from '../src/server/api/ai-pricing/app';
import { createCorrectionsApp } from '../src/server/api/corrections/app';
import {
  createExercisesApp,
  type ExerciseRepository,
} from '../src/server/api/exercises/app';
import {
  CorrectionOrchestrationService,
  type AcceptedQuoteSnapshot,
  type CorrectionPersistencePort,
  type CreditSettlementPort,
  type OrchestratedCorrectionResult,
  type RuntimeCorrectionAttempt,
} from '../src/server/corrections/correction-orchestration';
import { PROMOTED_CORRECTION_IDENTITY } from '../src/server/corrections/promoted-identity';
import {
  AiPricingQuoteService,
  type AiPricingQuoteRepository,
  type CreatePricingQuoteRecordInput,
  type StoredPricingQuote,
} from '../src/server/pricing/ai-pricing';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const LESSON_ID = '00000000-0000-4000-8000-000000000002';
const MODULE_RUN_ID = '00000000-0000-4000-8000-000000000003';
const NOW = new Date('2026-08-26T12:00:00.000Z');
const RESPONSE_TEXT =
  'Je réponds explicitement à la consigne avec une preuve observable. Le résultat est vérifiable et je limite ma conclusion au contexte fourni.';

const CASES: Array<{
  exerciseId: string;
  family: ProductiveExerciseActivityType;
  quoteId: string;
  submissionId: string;
}> = [
  {
    exerciseId: '10000000-0000-4000-8000-000000000001',
    family: 'writing',
    quoteId: '30000000-0000-4000-8000-000000000001',
    submissionId: '20000000-0000-4000-8000-000000000001',
  },
  {
    exerciseId: '10000000-0000-4000-8000-000000000002',
    family: 'reflection',
    quoteId: '30000000-0000-4000-8000-000000000002',
    submissionId: '20000000-0000-4000-8000-000000000002',
  },
  {
    exerciseId: '10000000-0000-4000-8000-000000000003',
    family: 'practice',
    quoteId: '30000000-0000-4000-8000-000000000003',
    submissionId: '20000000-0000-4000-8000-000000000003',
  },
  {
    exerciseId: '10000000-0000-4000-8000-000000000004',
    family: 'project',
    quoteId: '30000000-0000-4000-8000-000000000004',
    submissionId: '20000000-0000-4000-8000-000000000004',
  },
];

const authentication: MiddlewareHandler<AuthEnvironment> = async (
  context,
  next,
) => {
  context.set('user', {
    displayName: 'Apprenant pilote',
    email: 'learner@example.com',
    id: USER_ID,
    locale: 'fr',
    role: 'USER',
  });
  await next();
};

const authorization: MiddlewareHandler<AuthEnvironment> = async (
  _context,
  next,
) => next();

function jsonRequest(body: unknown, method: 'PATCH' | 'POST' = 'POST') {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  };
}

function buildExerciseHarness(input: (typeof CASES)[number]) {
  let progressWrites = 0;
  let submission:
    | {
        contentMarkdown: string;
        createdAt: Date;
        exerciseId: string;
        id: string;
        moduleRunId: string;
        status: 'DRAFT' | 'SUBMITTED';
        submittedAt: Date | null;
        updatedAt: Date;
        userId: string;
      }
    | undefined;
  const exercise = {
    activityType: input.family,
    id: input.exerciseId,
    instructions:
      'Répondez à la consigne, montrez une preuve observable et délimitez la conclusion.',
    isRequired: true,
    key: `activity-${input.family}`,
    language: 'fr-FR',
    lessonObjectives: ['Distinguer une preuve et une conclusion.'],
    lessonSlug: `lesson-${input.family}`,
    lessonSummary:
      'La leçon demande une réponse explicite, vérifiable et limitée au contexte.',
    lessonId: LESSON_ID,
    position: 1,
    programSlug: 'programme-recette-v4',
    rubric: null,
    title: `Production ${input.family}`,
  };
  const repository: ExerciseRepository = {
    async createOrGetSubmission(exerciseId, userId) {
      if (exerciseId !== input.exerciseId || userId !== USER_ID) {
        throw new Error('Unexpected exercise owner.');
      }
      submission ??= {
        contentMarkdown: '',
        createdAt: NOW,
        exerciseId,
        id: input.submissionId,
        moduleRunId: MODULE_RUN_ID,
        status: 'DRAFT',
        submittedAt: null,
        updatedAt: NOW,
        userId,
      };
      return submission;
    },
    async findExerciseForUser(exerciseId, userId) {
      if (exerciseId !== input.exerciseId || userId !== USER_ID) return null;
      return { ...exercise, submission: submission ?? null };
    },
    async findOwnedSubmission(submissionId, userId) {
      if (submissionId !== input.submissionId || userId !== USER_ID) return null;
      return submission ?? null;
    },
    async saveSubmission(submissionId, contentMarkdown, userId) {
      if (
        !submission ||
        submissionId !== input.submissionId ||
        userId !== USER_ID
      ) {
        throw new Error('Missing submission.');
      }
      submission = { ...submission, contentMarkdown, updatedAt: NOW };
      return submission;
    },
    async submitSubmission(submissionId, submittedAt, userId) {
      if (
        !submission ||
        submissionId !== input.submissionId ||
        userId !== USER_ID
      ) {
        throw new Error('Missing submission.');
      }
      progressWrites += 1;
      submission = {
        ...submission,
        status: 'SUBMITTED',
        submittedAt,
        updatedAt: submittedAt,
      };
      return submission;
    },
  };

  const resolved = resolveExerciseCorrectionContract({
    activityKey: exercise.key,
    activityType: exercise.activityType,
    explicitContract: exercise.rubric,
    instructions: exercise.instructions,
    language: exercise.language,
    lessonObjectives: exercise.lessonObjectives,
    lessonSlug: exercise.lessonSlug,
    lessonSummary: exercise.lessonSummary,
    programSlug: exercise.programSlug,
    title: exercise.title,
  });
  if (!resolved.eligible) throw new Error('Expected an eligible contract.');

  return {
    contract: resolved.contract,
    exercise,
    get progressWrites() {
      return progressWrites;
    },
    repository,
  };
}

function buildPricingRepository(input: {
  contract: CorrectionContract;
  family: ProductiveExerciseActivityType;
  quoteId: string;
  submissionId: string;
}) {
  let idempotencyKey: string | null = null;
  let quote: StoredPricingQuote | null = null;
  const repository: AiPricingQuoteRepository = {
    async createQuote(record: CreatePricingQuoteRecordInput) {
      idempotencyKey = record.idempotencyKey;
      quote = {
        action: record.entry.action,
        catalogVersionId: record.catalog.id,
        ceilingCredits: record.price.ceilingCredits,
        contractKey: record.target.contract.contractKey,
        contractVersion: record.target.contract.version,
        costDimensionsSnapshot: record.catalog.costDimensions,
        createdAt: NOW,
        estimatedCredits: record.price.estimatedCredits,
        expiresAt: record.expiresAt,
        feeCredits: record.entry.feeCredits,
        floorCredits: record.price.floorCredits,
        id: input.quoteId,
        includesAutomaticSecondPass:
          record.entry.includesAutomaticSecondPass,
        includesTargetedVerification:
          record.entry.includesTargetedVerification,
        inputSizeClass: record.entry.inputSizeClass,
        language: record.catalog.language,
        modelId: record.catalog.modelId,
        pipelineIdentitySnapshot: record.catalog.pipelineIdentitySnapshot,
        pipelineVersionId: record.catalog.pipelineVersionId,
        promptVersion: record.catalog.promptVersion,
        provider: record.catalog.provider,
        requestFingerprint: record.requestFingerprint,
        target: record.target.target,
        targetMarginCredits: record.entry.targetMarginCredits,
        userId: record.userId,
        workflowKind: record.catalog.workflowKind,
      };
      return quote;
    },
    async findActiveEntry() {
      return {
        catalog: {
          benchmarkId: PROMOTED_CORRECTION_IDENTITY.benchmarkId,
          corpusId: 'v4-r1-offline-acceptance',
          costDimensions: null,
          currency: 'LEARNX_CREDIT' as const,
          id: `catalog-${input.family}`,
          language: 'fr-FR',
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
          pipelineIdentitySnapshot: null,
          pipelineVersionId: null,
          promptVersion: PROMOTED_CORRECTION_IDENTITY.promptVersion,
          provider: PROMOTED_CORRECTION_IDENTITY.provider,
          providerRateCardEffectiveAt: NOW,
          providerRateCardVersion: 'offline-fixture',
          quoteTtlSeconds: 900,
          usesPromotionalProviderRates: false,
          version: '4.0.0',
          workflowKind: 'SINGLE_MODEL' as const,
        },
        entry: {
          action: 'STANDARD' as const,
          catalogVersionId: `catalog-${input.family}`,
          feeCredits: 0n,
          floorCredits: 3n,
          id: `entry-${input.family}`,
          includesAutomaticSecondPass: true,
          includesTargetedVerification: false,
          inputSizeClass: 'SHORT' as const,
          providerMedianCostCredits: 3n,
          providerMedianCostUsd: '0.00000000',
          providerP90CostCredits: 6n,
          providerP90CostUsd: '0.00000000',
          safetyCoefficientBasisPoints: 10_000n,
          targetMarginCredits: 0n,
        },
      };
    },
    async findQuoteByIdempotency(userId, requestedKey) {
      return userId === USER_ID && requestedKey === idempotencyKey
        ? quote
        : null;
    },
    async findQuoteById(userId, quoteId) {
      return userId === USER_ID && quoteId === quote?.id ? quote : null;
    },
    async isQuoteCurrentlyCompatible() {
      return true;
    },
    async resolveTarget(userId, target) {
      if (
        userId !== USER_ID ||
        target.kind !== 'EXERCISE_SUBMISSION' ||
        target.id !== input.submissionId
      ) {
        return null;
      }
      return {
        contract: input.contract,
        inputChars: RESPONSE_TEXT.length,
        language: 'fr-FR',
        target,
      };
    },
  };

  return {
    get quote() {
      return quote;
    },
    repository,
  };
}

function successfulOutput(contract: CorrectionContract) {
  const exactEvidence =
    'Je réponds explicitement à la consigne avec une preuve observable.';
  return {
    criteria: Object.fromEntries(
      contract.criteria.map((criterion) => [
        criterion.key,
        {
          confidence: 0.95,
          evidenceQuotes: [exactEvidence],
          evidenceStatus: 'FOUND',
          feedback: 'Le critère est démontré par un extrait exact.',
          levelKey: 'mastered',
        },
      ]),
    ),
    overallFeedback:
      'La réponse traite la consigne, fournit une preuve et délimite sa portée.',
  };
}

function buildCorrectionHarness(input: {
  contract: CorrectionContract;
  exerciseInstructions: string;
  pricing: ReturnType<typeof buildPricingRepository>;
  submissionId: string;
}) {
  let latest: OrchestratedCorrectionResult | null = null;
  const calls = {
    attemptIntents: [] as unknown[],
    attemptOutcomes: [] as RuntimeCorrectionAttempt[],
    begin: 0,
    consumed: 0,
    finalize: 0,
    release: 0,
    reserve: 0,
    settle: 0,
    transport: 0,
  };
  const credits: CreditSettlementPort = {
    async release() {
      calls.release += 1;
    },
    async reserve() {
      calls.reserve += 1;
      return { reservationId: `reservation-${input.submissionId}` };
    },
    async settle() {
      calls.settle += 1;
    },
  };
  const corrections: CorrectionPersistencePort = {
    async begin() {
      calls.begin += 1;
      return {
        correctionId: `correction-${input.submissionId}`,
        created: true,
      };
    },
    async finalize() {
      calls.finalize += 1;
    },
    async findByQuote() {
      return null;
    },
    async markReconciliationRequired() {
      return undefined;
    },
    async recordAttemptIntent(attempt) {
      calls.attemptIntents.push(attempt);
    },
    async recordAttemptOutcome({ attempt }) {
      calls.attemptOutcomes.push(attempt);
    },
  };
  const service = new CorrectionOrchestrationService(
    {
      async loadAcceptedQuote({ quoteId, userId }) {
        const quote = input.pricing.quote;
        if (!quote || quote.id !== quoteId || userId !== USER_ID) return null;
        const snapshot: AcceptedQuoteSnapshot = {
          contract: input.contract,
          contractKey: quote.contractKey,
          contractVersion: quote.contractVersion,
          estimatedCredits: quote.estimatedCredits,
          exerciseInstructions: input.exerciseInstructions,
          expiresAt: quote.expiresAt,
          includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
          language: quote.language,
          maximumReservedCredits: quote.ceilingCredits,
          modelId: quote.modelId,
          promptVersion: quote.promptVersion,
          provider: quote.provider ?? '',
          quoteId: quote.id,
          requestFingerprint: quote.requestFingerprint,
          submissionText: RESPONSE_TEXT,
          target: quote.target,
          taskContext:
            'La conclusion doit rester limitée aux informations fournies.',
          userId,
        };
        return snapshot;
      },
      async markConsumed() {
        calls.consumed += 1;
      },
    },
    credits,
    corrections,
    {
      async execute() {
        calls.transport += 1;
        return {
          latencyMs: 12,
          modelSnapshot: PROMOTED_CORRECTION_IDENTITY.modelId,
          output: successfulOutput(input.contract),
          providerRequestId: 'offline-provider-request',
          providerRoute: PROMOTED_CORRECTION_IDENTITY.provider,
          usage: {
            actualCostUsd: 0,
            inputTokens: 0,
            reasoningTokens: 0,
            visibleOutputTokens: 0,
          },
        };
      },
    },
    { apiKey: 'offline-test-key', now: () => NOW },
  );

  return {
    calls,
    history: {
      async findLatestForSubmission(request: {
        submissionId: string;
        userId: string;
      }) {
        if (
          request.submissionId !== input.submissionId ||
          request.userId !== USER_ID ||
          !latest
        ) {
          return null;
        }
        return { ...latest, replay: true };
      },
    },
    orchestration: {
      async runAcceptedQuote(request: { quoteId: string; userId: string }) {
        latest = await service.runAcceptedQuote(request);
        return latest;
      },
    },
  };
}

describe('V4-010-R1 — recette authentifiée des productions textuelles', () => {
  it.each(CASES)(
    'couvre $family de la remise à l’historique sans appel ni débit supplémentaire',
    async (testCase) => {
      const exercises = buildExerciseHarness(testCase);
      const exerciseApp = createExercisesApp({
        authentication,
        now: () => NOW,
        repository: exercises.repository,
      });

      const exerciseResponse = await exerciseApp.request(
        `http://localhost/api/exercises/${testCase.exerciseId}`,
      );
      expect(exerciseResponse.status).toBe(200);
      await expect(exerciseResponse.json()).resolves.toMatchObject({
        exercise: { aiCorrectionEligible: true },
      });

      expect(
        (
          await exerciseApp.request(
            `http://localhost/api/exercises/${testCase.exerciseId}/submissions`,
            { method: 'POST' },
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await exerciseApp.request(
            `http://localhost/api/exercise-submissions/${testCase.submissionId}`,
            jsonRequest({ contentMarkdown: RESPONSE_TEXT }, 'PATCH'),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await exerciseApp.request(
            `http://localhost/api/exercise-submissions/${testCase.submissionId}/submit`,
            { method: 'POST' },
          )
        ).status,
      ).toBe(200);
      expect(exercises.progressWrites).toBe(1);

      const pricing = buildPricingRepository({
        contract: exercises.contract,
        family: testCase.family,
        quoteId: testCase.quoteId,
        submissionId: testCase.submissionId,
      });
      const pricingApp = createAiPricingApp({
        authentication,
        authorization,
        service: new AiPricingQuoteService(pricing.repository, () => NOW),
      });
      const quoteResponse = await pricingApp.request(
        'http://localhost/api/ai-correction/quotes',
        jsonRequest({
          action: 'STANDARD',
          idempotencyKey: `recipe:${testCase.family}:0001`,
          target: {
            id: testCase.submissionId,
            kind: 'EXERCISE_SUBMISSION',
          },
        }),
      );
      expect(quoteResponse.status).toBe(201);
      const quoteBody = await quoteResponse.json();
      expect(quoteBody).toMatchObject({
        resource: {
          quote: {
            currency: 'LEARNX_CREDIT',
            estimatedCredits: '3',
            maximumReservedCredits: '6',
          },
        },
      });

      const correction = buildCorrectionHarness({
        contract: exercises.contract,
        exerciseInstructions: exercises.exercise.instructions,
        pricing,
        submissionId: testCase.submissionId,
      });
      const correctionApp = createCorrectionsApp({
        authentication,
        authorization,
        history: correction.history,
        orchestration: correction.orchestration,
      });
      const correctionResponse = await correctionApp.request(
        'http://localhost/api/ai-corrections',
        jsonRequest({ quoteId: testCase.quoteId }),
      );
      expect(correctionResponse.status).toBe(201);
      const correctionBody = (await correctionResponse.json()) as {
        resource: {
          correction: {
            correction: { criteria: Array<{ key: string }> };
          };
        };
      };
      expect(correctionBody).toMatchObject({
        resource: {
          correction: {
            correction: {
              indicativeScore: 100,
              status: 'COMPLETED',
              unsureCriteria: [],
            },
            replay: false,
            settlement: {
              releasedCredits: '3',
              reservedCredits: '6',
              settledCredits: '3',
            },
          },
        },
      });
      expect(
        correctionBody.resource.correction.correction.criteria.map(
          (criterion) => criterion.key,
        ),
      ).toEqual(exercises.contract.criteria.map((criterion) => criterion.key));

      const publicPayload = JSON.stringify({ quoteBody, correctionBody });
      expect(publicPayload).not.toContain(
        PROMOTED_CORRECTION_IDENTITY.modelId,
      );
      expect(publicPayload).not.toContain(
        PROMOTED_CORRECTION_IDENTITY.provider,
      );
      expect(publicPayload).not.toContain('actualCostUsd');
      expect(publicPayload).not.toContain('inputTokens');

      const beforeHistory = structuredClone(correction.calls);
      const historyResponse = await correctionApp.request(
        `http://localhost/api/exercise-submissions/${testCase.submissionId}/ai-corrections/latest`,
      );
      expect(historyResponse.status).toBe(200);
      await expect(historyResponse.json()).resolves.toMatchObject({
        resource: { correction: { replay: true } },
      });

      expect(correction.calls).toEqual(beforeHistory);
      expect(correction.calls).toMatchObject({
        begin: 1,
        consumed: 1,
        finalize: 1,
        release: 0,
        reserve: 1,
        settle: 1,
        transport: 1,
      });
      expect(exercises.progressWrites).toBe(1);
    },
  );
});
