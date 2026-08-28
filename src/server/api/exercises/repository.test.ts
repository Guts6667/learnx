import { describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { createPrismaExerciseRepository } from './repository.js';
import { createExerciseService } from './service.js';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const EXERCISE_ID = '10000000-0000-4000-8000-000000000002';
const SUBMISSION_ID = '10000000-0000-4000-8000-000000000003';
const LESSON_ID = '10000000-0000-4000-8000-000000000004';
const MODULE_ID = '10000000-0000-4000-8000-000000000005';
const RUN_ID = '10000000-0000-4000-8000-000000000006';
const NEXT_RUN_ID = '10000000-0000-4000-8000-000000000007';
const NOW = new Date('2026-08-28T12:00:00.000Z');

function submission(status: 'DRAFT' | 'SUBMITTED' = 'DRAFT') {
  return {
    contentMarkdown: 'Une réponse argumentée.',
    createdAt: NOW,
    exerciseId: EXERCISE_ID,
    id: SUBMISSION_ID,
    moduleRunId: RUN_ID,
    status,
    submittedAt: null,
    updatedAt: NOW,
    userId: USER_ID,
  };
}

function run(id = RUN_ID) {
  return {
    id,
    moduleId: MODULE_ID,
    sequence: id === RUN_ID ? 1 : 2,
    startedAt: NOW,
    userId: USER_ID,
  };
}

function transactionFixture(currentRunId = RUN_ID) {
  return {
    exercise: {
      findFirst: vi.fn().mockResolvedValue({ lessonId: LESSON_ID }),
    },
    exerciseSubmission: {
      findFirst: vi.fn().mockResolvedValue({
        ...submission(),
        exercise: { lessonId: LESSON_ID },
      }),
      update: vi.fn().mockResolvedValue({
        ...submission('SUBMITTED'),
        submittedAt: NOW,
      }),
      upsert: vi.fn().mockResolvedValue(submission()),
    },
    lesson: {
      findUnique: vi.fn().mockResolvedValue({ moduleId: MODULE_ID }),
    },
    moduleRun: {
      findFirst: vi.fn().mockResolvedValue(run(currentRunId)),
      upsert: vi.fn(),
    },
  };
}

function clientFixture(transaction: ReturnType<typeof transactionFixture>) {
  return {
    $transaction: vi.fn(async (operation) => operation(transaction)),
    exerciseSubmission: {
      findFirst: vi.fn().mockResolvedValue({
        ...submission(),
        exercise: { lessonId: LESSON_ID },
      }),
    },
    lesson: {
      findUnique: vi.fn().mockResolvedValue({ moduleId: MODULE_ID }),
    },
    moduleRun: {
      findFirst: vi.fn().mockResolvedValue(run()),
    },
  };
}

describe('PrismaExerciseRepository transaction contracts', () => {
  it('keeps concurrent draft creation idempotent on the module-run key', async () => {
    const transaction = transactionFixture();
    const client = clientFixture(transaction);
    const repository = createPrismaExerciseRepository(
      client as unknown as PrismaClient,
    );

    const [first, second] = await Promise.all([
      repository.createOrGetSubmission(EXERCISE_ID, USER_ID),
      repository.createOrGetSubmission(EXERCISE_ID, USER_ID),
    ]);

    expect(first.id).toBe(SUBMISSION_ID);
    expect(second.id).toBe(SUBMISSION_ID);
    expect(transaction.exerciseSubmission.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.exerciseSubmission.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseId_moduleRunId: {
            exerciseId: EXERCISE_ID,
            moduleRunId: RUN_ID,
            userId: USER_ID,
          },
        },
      }),
    );
  });

  it('retries a P2034 conflict with the same Serializable contract', async () => {
    const transaction = transactionFixture();
    const client = clientFixture(transaction);
    client.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (operation) => operation(transaction));
    const repository = createPrismaExerciseRepository(
      client as unknown as PrismaClient,
    );

    await expect(
      repository.createOrGetSubmission(EXERCISE_ID, USER_ID),
    ).resolves.toMatchObject({ id: SUBMISSION_ID });

    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(client.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      maxWait: 5_000,
      timeout: 15_000,
    });
  });

  it('stops after three P2034 transaction attempts', async () => {
    const transaction = transactionFixture();
    const client = clientFixture(transaction);
    client.$transaction.mockRejectedValue({ code: 'P2034' });
    const repository = createPrismaExerciseRepository(
      client as unknown as PrismaClient,
    );

    await expect(
      repository.createOrGetSubmission(EXERCISE_ID, USER_ID),
    ).rejects.toEqual({ code: 'P2034' });

    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(transaction.exerciseSubmission.upsert).not.toHaveBeenCalled();
  });

  it('rejects a save when the module run changes after the service read', async () => {
    const transaction = transactionFixture(NEXT_RUN_ID);
    const client = clientFixture(transaction);
    const repository = createPrismaExerciseRepository(
      client as unknown as PrismaClient,
    );
    const service = createExerciseService(repository, () => NOW);

    await expect(
      service.saveSubmission(SUBMISSION_ID, 'Nouvelle version', USER_ID),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', status: 404 });

    expect(client.exerciseSubmission.findFirst).toHaveBeenCalledTimes(1);
    expect(transaction.exerciseSubmission.update).not.toHaveBeenCalled();
  });

  it('submits and recalculates progress inside one transaction', async () => {
    const transaction = transactionFixture();
    const client = clientFixture(transaction);
    const recalculate = vi.fn().mockResolvedValue({ percent: 50 });
    const repository = createPrismaExerciseRepository(
      client as unknown as PrismaClient,
      recalculate,
    );
    const service = createExerciseService(repository, () => NOW);

    await expect(
      service.submitSubmission(SUBMISSION_ID, USER_ID),
    ).resolves.toMatchObject({ status: 'SUBMITTED', submittedAt: NOW });

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.exerciseSubmission.update).toHaveBeenCalledTimes(1);
    expect(recalculate).toHaveBeenCalledWith(
      transaction,
      LESSON_ID,
      USER_ID,
      NOW,
      { requirePublished: true },
    );
  });
});
