import { describe, expect, it, vi } from 'vitest';

import {
  TaskCompletionStatus,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import type { LessonProgressSnapshot } from '../_lib/progress-recalculation.js';
import { createProgressService } from './service.js';
import type { ProgressServiceOptions } from './types.js';

const lessonId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-08-28T09:00:00.000Z');

function snapshot(): LessonProgressSnapshot {
  return {
    canComplete: true,
    conceptStatusById: new Map(),
    exerciseStatusById: new Map(),
    lessonProgress: null,
    percent: 100,
    quizPassedById: new Map(),
    resourceStatusById: new Map(),
    taskStatusById: new Map([[taskId, TaskCompletionStatus.DONE]]),
  };
}

describe('progress service transaction contract', () => {
  it('mutates an activity and recalculates its hierarchy in one unit of work', async () => {
    const transaction = {
      task: {
        findFirst: vi.fn(async () => ({ id: taskId, lessonId })),
      },
      taskCompletion: { upsert: vi.fn(async () => ({})) },
    } as unknown as Prisma.TransactionClient;
    const client = {} as PrismaClient;
    const recalculateLesson = vi.fn(async () => snapshot());
    const runTransaction = vi.fn(
      async <T>(
        receivedClient: PrismaClient,
        operation: (unit: Prisma.TransactionClient) => Promise<T>,
      ) => {
        expect(receivedClient).toBe(client);
        return operation(transaction);
      },
    );
    const service = createProgressService({
      client,
      readLessonSnapshot: vi.fn(),
      readProgramTimeline: vi.fn(),
      readStageTimeline: vi.fn(),
      recalculateLesson,
      runTransaction,
    } as unknown as ProgressServiceOptions);

    await expect(
      service.updateTask(taskId, userId, TaskCompletionStatus.DONE, now),
    ).resolves.toMatchObject({ canComplete: true, percent: 100 });

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(transaction.task.findFirst).toHaveBeenCalledOnce();
    expect(transaction.taskCompletion.upsert).toHaveBeenCalledOnce();
    expect(recalculateLesson).toHaveBeenCalledWith(
      transaction,
      lessonId,
      userId,
      now,
      { requirePublished: true },
    );
  });
});
