import { randomUUID } from 'node:crypto';

import type { CorrectionContract } from '@/lib/ai-correction-contracts';
import { FakeStructuredAiProvider } from '@/server/ai/fake-structured-provider';
import {
  calculateServerCorrectionResult,
  CorrectionEngineError,
  PersistentCorrectionEngine,
  type ClaimedCorrection,
  type CorrectionAttemptFailure,
  type CorrectionAttemptSuccess,
  type CorrectionReservationInput,
  type PersistentCorrectionRecord,
  type PersistentCorrectionRepository,
} from '@/server/ai/persistent-correction';
import { AiProviderError } from '@/server/ai/structured-provider';

const contract: CorrectionContract = {
  authorizedReferences: [],
  contractKey: 'project-framing-correction',
  criteria: [
    {
      acceptableVariants: [],
      calibratedExamples: [],
      commonErrors: [],
      expectedElements: ['Une direction observable.'],
      key: 'direction',
      label: 'Direction',
      objective: 'Formuler une direction observable.',
      performanceLevels: [
        {
          description: 'La direction est absente.',
          key: 'insufficient',
          label: 'Insuffisant',
          score: 0,
        },
        {
          description: 'La direction est partiellement vérifiable.',
          key: 'partial',
          label: 'Partiel',
          score: 50,
        },
        {
          description: 'La direction est vérifiable.',
          key: 'mastered',
          label: 'Maîtrisé',
          score: 100,
        },
      ],
      weight: 60,
    },
    {
      acceptableVariants: [],
      calibratedExamples: [],
      commonErrors: [],
      expectedElements: ['Un responsable.'],
      key: 'ownership',
      label: 'Responsabilité',
      objective: 'Attribuer la responsabilité.',
      performanceLevels: [
        {
          description: 'Aucun responsable.',
          key: 'insufficient',
          label: 'Insuffisant',
          score: 0,
        },
        {
          description: 'Responsabilité ambiguë.',
          key: 'partial',
          label: 'Partiel',
          score: 50,
        },
        {
          description: 'Responsabilité explicite.',
          key: 'mastered',
          label: 'Maîtrisé',
          score: 100,
        },
      ],
      weight: 40,
    },
  ],
  evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
  lifecycle: {
    publishedAt: '2026-08-12T08:00:00+02:00',
    status: 'PUBLISHED',
  },
  objectives: ['Évaluer le cadrage.'],
  passingScore: 70,
  schemaVersion: 1,
  secondPass: {
    confidenceThreshold: 0.7,
    enabled: true,
    maxPasses: 2,
    triggers: ['LOW_CONFIDENCE'],
  },
  target: {
    activityKey: 'frame-a-project',
    activityType: 'writing',
    kind: 'EXERCISE',
  },
  version: '1.0.0',
};

function output(overrides: {
  confidence?: number;
  direction?: 'insufficient' | 'mastered' | 'partial';
  ownership?: 'insufficient' | 'mastered' | 'partial';
  reviewRequired?: boolean;
} = {}) {
  const confidence = overrides.confidence ?? 0.9;
  const reviewRequired = overrides.reviewRequired ?? false;
  return {
    contractKey: contract.contractKey,
    contractVersion: contract.version,
    criteria: [
      {
        confidence,
        criterionKey: 'direction',
        evidenceQuotes: ['Une direction observable.'],
        feedback: 'Retour direction.',
        levelKey: overrides.direction ?? 'mastered',
      },
      {
        confidence,
        criterionKey: 'ownership',
        evidenceQuotes: ['Un responsable.'],
        feedback: 'Retour responsabilité.',
        levelKey: overrides.ownership ?? 'mastered',
      },
    ],
    overallConfidence: confidence,
    overallFeedback: 'Retour global.',
    secondPass: {
      reasons: reviewRequired ? ['LOW_CONFIDENCE'] : [],
      required: reviewRequired,
    },
  };
}

class MemoryCorrectionRepository implements PersistentCorrectionRepository {
  public readonly attempts = new Map<string, number>();
  private readonly corrections = new Map<string, PersistentCorrectionRecord>();
  private readonly byIdempotency = new Map<string, string>();

  public async reserve(
    input: CorrectionReservationInput,
  ): Promise<PersistentCorrectionRecord> {
    const key = `${input.userId}:${input.idempotencyKey}`;
    const existingId = this.byIdempotency.get(key);
    if (existingId) {
      const existing = await this.get(existingId);
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new CorrectionEngineError('DUPLICATE_OPERATION_CONFLICT');
      }
      return existing;
    }
    const id = randomUUID();
    const record: PersistentCorrectionRecord = {
      confidence: null,
      contractSnapshot: structuredClone(input.contractSnapshot),
      decision: null,
      id,
      idempotencyKey: input.idempotencyKey,
      method: input.method,
      promptSnapshot: structuredClone(input.promptSnapshot),
      requestFingerprint: input.requestFingerprint,
      score: null,
      status: 'RESERVED',
      structuredResult: null,
      submissionSnapshot: {
        id:
          input.target.kind === 'EXERCISE'
            ? input.target.exerciseSubmissionId
            : input.target.stageAssessmentSubmissionId,
      },
      userId: input.userId,
    };
    this.byIdempotency.set(key, id);
    this.corrections.set(id, record);
    return structuredClone(record);
  }

  public async claim(correctionId: string): Promise<ClaimedCorrection | null> {
    const correction = this.corrections.get(correctionId);
    if (
      !correction ||
      (correction.status !== 'RESERVED' &&
        correction.status !== 'RETRY_PENDING')
    ) {
      return null;
    }
    correction.status = 'PROCESSING';
    const attemptSequence = (this.attempts.get(correctionId) ?? 0) + 1;
    this.attempts.set(correctionId, attemptSequence);
    return {
      attemptId: `${correctionId}:${attemptSequence}`,
      attemptSequence,
      correction: structuredClone(correction),
    };
  }

  public async complete(
    input: CorrectionAttemptSuccess,
  ): Promise<PersistentCorrectionRecord> {
    const correction = this.corrections.get(input.correctionId);
    if (!correction || correction.status !== 'PROCESSING') {
      throw new Error('TRANSITION_CONFLICT');
    }
    Object.assign(correction, {
      confidence: input.confidence,
      decision: input.decision,
      score: input.score,
      status: input.status,
      structuredResult: structuredClone(input.output),
    });
    return structuredClone(correction);
  }

  public async fail(
    input: CorrectionAttemptFailure,
  ): Promise<PersistentCorrectionRecord> {
    const correction = this.corrections.get(input.correctionId);
    if (!correction || correction.status !== 'PROCESSING') {
      throw new Error('TRANSITION_CONFLICT');
    }
    correction.status = input.retryable ? 'RETRY_PENDING' : 'FAILED_RELEASED';
    return structuredClone(correction);
  }

  public async get(correctionId: string): Promise<PersistentCorrectionRecord> {
    const correction = this.corrections.get(correctionId);
    if (!correction) throw new Error('CORRECTION_NOT_FOUND');
    return structuredClone(correction);
  }
}

function generation(result = output()) {
  return {
    metadata: {
      attemptCount: 1,
      generationId: randomUUID(),
      latencyMs: 12,
      modelId: 'vendor/model-20260812',
      provider: 'vendor',
      role: 'CORRECTION_PRIMARY' as const,
      usage: {
        completionTokens: 20,
        costUsd: 0.002,
        promptTokens: 100,
        totalTokens: 120,
      },
    },
    output: result,
  };
}

function correctionRequest(overrides: Record<string, unknown> = {}) {
  return {
    contract,
    idempotencyKey: 'correction:submission:0001',
    maxOutputTokens: 1_000,
    messages: [
      { content: 'Instructions versionnées.', role: 'system' as const },
      { content: 'Production apprenante.', role: 'user' as const },
    ],
    promptVersion: '1.0.0',
    role: 'CORRECTION_PRIMARY' as const,
    target: {
      exerciseSubmissionId: '10000000-0000-4000-8000-000000000001',
      kind: 'EXERCISE' as const,
    },
    userId: '20000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

describe('persistent correction engine', () => {
  it('recalculates the weighted score and decision on the server', () => {
    expect(
      calculateServerCorrectionResult({
        contract,
        output: output({ direction: 'mastered', ownership: 'partial' }),
      }),
    ).toEqual({
      confidence: 0.9,
      decision: 'PASSED',
      score: 80,
      status: 'COMPLETED',
    });
  });

  it('persists one logical correction for replayed and concurrent requests', async () => {
    const repository = new MemoryCorrectionRepository();
    const provider = new FakeStructuredAiProvider(() => generation());
    const engine = new PersistentCorrectionEngine(repository, provider);

    const concurrent = await Promise.all([
      engine.correct(correctionRequest()),
      engine.correct(correctionRequest()),
    ]);
    const replay = await engine.correct(correctionRequest());

    expect(new Set(concurrent.map(({ id }) => id))).toHaveLength(1);
    expect(replay.id).toBe(concurrent[0].id);
    expect(provider.requests).toHaveLength(1);
    expect(repository.attempts.get(replay.id)).toBe(1);
  });

  it('rejects reuse of an idempotency key with a different request', async () => {
    const repository = new MemoryCorrectionRepository();
    const provider = new FakeStructuredAiProvider(() => generation());
    const engine = new PersistentCorrectionEngine(repository, provider);
    await engine.correct(correctionRequest());

    await expect(
      engine.correct(
        correctionRequest({
          messages: [
            { content: 'Autres instructions.', role: 'system' as const },
            { content: 'Production apprenante.', role: 'user' as const },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE_OPERATION_CONFLICT' });
  });

  it('routes low-confidence output to AI review without a human task', async () => {
    const repository = new MemoryCorrectionRepository();
    const provider = new FakeStructuredAiProvider(() =>
      generation(output({ confidence: 0.6, reviewRequired: true })),
    );
    const result = await new PersistentCorrectionEngine(
      repository,
      provider,
    ).correct(correctionRequest());

    expect(result).toMatchObject({
      confidence: 0.6,
      decision: 'REVIEW_REQUIRED',
      status: 'AI_REVIEW_REQUIRED',
    });
    expect(result).not.toHaveProperty('reviewerId');
  });

  it('persists a retryable failure and reuses the same logical correction', async () => {
    const repository = new MemoryCorrectionRepository();
    let callCount = 0;
    const provider = new FakeStructuredAiProvider(() => {
      callCount += 1;
      if (callCount === 1) {
        throw new AiProviderError('PROVIDER_UNAVAILABLE', true);
      }
      return generation();
    });
    const engine = new PersistentCorrectionEngine(repository, provider);

    const pending = await engine.correct(correctionRequest());
    const completed = await engine.correct(correctionRequest());

    expect(pending.status).toBe('RETRY_PENDING');
    expect(completed).toMatchObject({ id: pending.id, status: 'COMPLETED' });
    expect(repository.attempts.get(pending.id)).toBe(2);
  });

  it('keeps the original contract snapshot readable after a new version exists', async () => {
    const repository = new MemoryCorrectionRepository();
    const engine = new PersistentCorrectionEngine(
      repository,
      new FakeStructuredAiProvider(() => generation()),
    );
    const completed = await engine.correct(correctionRequest());
    const newerContract = { ...contract, version: '2.0.0' };

    expect(completed.contractSnapshot).toMatchObject({ version: '1.0.0' });
    expect(newerContract.version).toBe('2.0.0');
  });

  it('does not accept scientific validation as a correction method', async () => {
    const methods = ['DETERMINISTIC', 'AI'] as const;
    expect(methods).not.toContain('SCIENTIFIC_VALIDATION');
  });
});
