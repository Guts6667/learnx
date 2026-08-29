import type { PrismaClient } from '../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import { CorrectionEngineError } from './persistent-correction.js';
import {
  CorrectionPersistenceError,
  PrismaCorrectionRepository,
} from './prisma-correction-repository.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function storedCorrection(overrides: Record<string, unknown> = {}) {
  return {
    confidence: null,
    contractSnapshot: { contractKey: 'writing' },
    decision: null,
    id: 'correction-1',
    idempotencyKey: 'correction:submission:1',
    method: 'AI',
    modelRole: 'CORRECTION_PRIMARY',
    promptSnapshot: { messages: [] },
    requestFingerprint: 'fingerprint-1',
    score: null,
    status: 'RESERVED',
    structuredResult: null,
    submissionSnapshot: { id: 'submission-1' },
    userId: 'user-1',
    ...overrides,
  };
}

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    contractSnapshot: { contractKey: 'writing' },
    idempotencyKey: 'correction:submission:1',
    method: 'AI' as const,
    modelRole: 'CORRECTION_PRIMARY' as const,
    promptSnapshot: { messages: [], outputSchemaName: 'correction' },
    promptVersion: '1.0.0',
    requestFingerprint: 'fingerprint-1',
    target: {
      exerciseSubmissionId: 'submission-1',
      kind: 'EXERCISE' as const,
    },
    userId: 'user-1',
    ...overrides,
  } as never;
}

function harness() {
  const transaction = {
    aiCorrection: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    aiCorrectionAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    exerciseSubmission: { findFirst: vi.fn() },
    stageAssessmentSubmission: { findFirst: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
    aiCorrection: transaction.aiCorrection,
  };
  return {
    prisma,
    repository: new PrismaCorrectionRepository(
      prisma as unknown as PrismaClient,
    ),
    transaction,
  };
}

describe('PrismaCorrectionRepository', () => {
  it('reserves an exercise correction with an immutable submission snapshot', async () => {
    const { repository, transaction } = harness();
    transaction.aiCorrection.findUnique.mockResolvedValueOnce(null);
    transaction.exerciseSubmission.findFirst.mockResolvedValueOnce({
      contentMarkdown: 'Ma réponse.',
      exerciseId: 'exercise-1',
      id: 'submission-1',
      moduleRunId: 'run-1',
      submittedAt: now,
    });
    transaction.aiCorrection.create.mockResolvedValueOnce(storedCorrection());

    await expect(repository.reserve(reservation())).resolves.toMatchObject({
      id: 'correction-1',
      status: 'RESERVED',
    });
    expect(transaction.aiCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exerciseSubmissionId: 'submission-1',
        stageAssessmentSubmissionId: null,
        submissionSnapshot: {
          contentMarkdown: 'Ma réponse.',
          exerciseId: 'exercise-1',
          id: 'submission-1',
          kind: 'EXERCISE',
          moduleRunId: 'run-1',
          submittedAt: now.toISOString(),
        },
      }),
    });
  });

  it('reserves a stage assessment and rejects missing submissions', async () => {
    const { repository, transaction } = harness();
    transaction.aiCorrection.findUnique.mockResolvedValue(null);
    transaction.stageAssessmentSubmission.findFirst.mockResolvedValueOnce({
      attachmentUrl: null,
      contentMarkdown: 'Bilan.',
      id: 'stage-submission-1',
      stageAssessmentId: 'assessment-1',
      submittedAt: null,
    });
    transaction.aiCorrection.create.mockResolvedValueOnce(storedCorrection());

    await repository.reserve(
      reservation({
        target: {
          kind: 'STAGE_ASSESSMENT',
          stageAssessmentSubmissionId: 'stage-submission-1',
        },
      }),
    );
    expect(transaction.aiCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exerciseSubmissionId: null,
        stageAssessmentSubmissionId: 'stage-submission-1',
        submissionSnapshot: expect.objectContaining({
          kind: 'STAGE_ASSESSMENT',
          submittedAt: null,
        }),
      }),
    });

    transaction.exerciseSubmission.findFirst.mockResolvedValueOnce(null);
    await expect(repository.reserve(reservation())).rejects.toEqual(
      new CorrectionPersistenceError('SUBMISSION_NOT_CORRECTABLE'),
    );
  });

  it('replays matching reservations and rejects a changed fingerprint', async () => {
    const { repository, transaction } = harness();
    transaction.aiCorrection.findUnique.mockResolvedValueOnce(
      storedCorrection(),
    );
    await expect(repository.reserve(reservation())).resolves.toMatchObject({
      requestFingerprint: 'fingerprint-1',
    });
    expect(transaction.exerciseSubmission.findFirst).not.toHaveBeenCalled();

    transaction.aiCorrection.findUnique.mockResolvedValueOnce(
      storedCorrection({ requestFingerprint: 'other' }),
    );
    await expect(repository.reserve(reservation())).rejects.toEqual(
      new CorrectionEngineError('DUPLICATE_OPERATION_CONFLICT'),
    );
  });

  it('recovers a concurrent unique insert only when its fingerprint matches', async () => {
    const { prisma, repository, transaction } = harness();
    transaction.aiCorrection.findUnique.mockResolvedValueOnce(null);
    transaction.exerciseSubmission.findFirst.mockResolvedValue({
      contentMarkdown: 'Réponse.',
      exerciseId: 'exercise-1',
      id: 'submission-1',
      moduleRunId: 'run-1',
      submittedAt: now,
    });
    transaction.aiCorrection.create.mockRejectedValue({ code: 'P2002' });
    prisma.aiCorrection.findUnique.mockResolvedValueOnce(storedCorrection());
    await expect(repository.reserve(reservation())).resolves.toMatchObject({
      id: 'correction-1',
    });

    prisma.aiCorrection.findUnique.mockResolvedValueOnce(
      storedCorrection({ requestFingerprint: 'other' }),
    );
    await expect(repository.reserve(reservation())).rejects.toEqual(
      new CorrectionEngineError('DUPLICATE_OPERATION_CONFLICT'),
    );

    prisma.aiCorrection.findUnique.mockResolvedValueOnce(null);
    await expect(repository.reserve(reservation())).rejects.toEqual({
      code: 'P2002',
    });
  });

  it('claims only reserved or retry-pending corrections', async () => {
    const { repository, transaction } = harness();
    transaction.aiCorrection.findUnique.mockResolvedValueOnce(null);
    await expect(repository.claim('missing')).rejects.toEqual(
      new CorrectionPersistenceError('CORRECTION_NOT_FOUND'),
    );

    transaction.aiCorrection.findUnique.mockResolvedValueOnce(
      storedCorrection({ status: 'COMPLETED' }),
    );
    await expect(repository.claim('correction-1')).resolves.toBeNull();

    transaction.aiCorrection.findUnique.mockResolvedValueOnce(
      storedCorrection({ status: 'RETRY_PENDING' }),
    );
    transaction.aiCorrection.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.claim('correction-1')).resolves.toBeNull();

    transaction.aiCorrection.findUnique.mockResolvedValueOnce(
      storedCorrection(),
    );
    transaction.aiCorrection.updateMany.mockResolvedValueOnce({ count: 1 });
    transaction.aiCorrectionAttempt.count.mockResolvedValueOnce(2);
    transaction.aiCorrectionAttempt.create.mockResolvedValueOnce({
      id: 'attempt-3',
    });
    await expect(repository.claim('correction-1')).resolves.toMatchObject({
      attemptId: 'attempt-3',
      attemptSequence: 3,
      correction: { status: 'PROCESSING' },
    });
  });

  it('completes and fails attempts only through valid transitions', async () => {
    const { repository, transaction } = harness();
    transaction.aiCorrectionAttempt.updateMany.mockResolvedValue({ count: 1 });
    transaction.aiCorrection.updateMany.mockResolvedValue({ count: 1 });
    transaction.aiCorrection.findUnique
      .mockResolvedValueOnce(storedCorrection({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(storedCorrection({ status: 'RETRY_PENDING' }))
      .mockResolvedValueOnce(storedCorrection({ status: 'FAILED_RELEASED' }));

    await expect(
      repository.complete({
        attemptId: 'attempt-1',
        confidence: 0.9,
        correctionId: 'correction-1',
        decision: 'PASSED',
        metadata: {
          attemptCount: 1,
          generationId: 'generation-1',
          latencyMs: 10,
          modelId: 'model-1',
          provider: 'provider-1',
          role: 'CORRECTION_PRIMARY',
          usage: {
            completionTokens: 20,
            costUsd: 0.01,
            promptTokens: 100,
            totalTokens: 120,
          },
        },
        output: {} as never,
        score: 90,
        status: 'COMPLETED',
      }),
    ).resolves.toMatchObject({ status: 'COMPLETED' });

    await expect(
      repository.fail({
        attemptId: 'attempt-2',
        correctionId: 'correction-1',
        errorCode: 'TIMEOUT',
        retryable: true,
      }),
    ).resolves.toMatchObject({ status: 'RETRY_PENDING' });
    expect(transaction.aiCorrection.updateMany).toHaveBeenLastCalledWith({
      data: { completedAt: null, status: 'RETRY_PENDING' },
      where: { id: 'correction-1', status: 'PROCESSING' },
    });

    await expect(
      repository.fail({
        attemptId: 'attempt-3',
        correctionId: 'correction-1',
        errorCode: 'INVALID',
        retryable: false,
      }),
    ).resolves.toMatchObject({ status: 'FAILED_RELEASED' });
  });

  it('rejects transition races and missing final records', async () => {
    const { repository, transaction } = harness();
    transaction.aiCorrectionAttempt.updateMany.mockResolvedValue({ count: 0 });
    transaction.aiCorrection.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.fail({
        attemptId: 'attempt-1',
        correctionId: 'correction-1',
        errorCode: 'TIMEOUT',
        retryable: true,
      }),
    ).rejects.toEqual(new CorrectionPersistenceError('TRANSITION_CONFLICT'));

    transaction.aiCorrection.findUnique.mockResolvedValueOnce(null);
    await expect(repository.get('missing')).rejects.toEqual(
      new CorrectionPersistenceError('CORRECTION_NOT_FOUND'),
    );
  });

  it('retries serializable transaction conflicts at most three times', async () => {
    const { prisma, repository, transaction } = harness();
    transaction.aiCorrection.findUnique.mockResolvedValue(
      storedCorrection({ status: 'COMPLETED' }),
    );
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (operation) => operation(transaction));
    await expect(repository.claim('correction-1')).resolves.toBeNull();
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);

    prisma.$transaction.mockReset();
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(repository.claim('correction-1')).rejects.toEqual({
      code: 'P2034',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});
