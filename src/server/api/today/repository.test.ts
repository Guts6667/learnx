import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { createPrismaTodayRepository } from './repository.js';

const userId = '11111111-1111-4111-8111-111111111111';

function lesson(moduleId: string, carryoverRunIds: string[]) {
  return {
    activityCompletionCarryovers: carryoverRunIds.map((moduleRunId) => ({
      activityKey: `activity-${moduleRunId}`,
      kind: 'TASK',
      moduleRunId,
    })),
    module: { id: moduleId },
  };
}

describe('Prisma Today repository', () => {
  it('does not query module runs when no published lesson is accessible', async () => {
    const moduleRuns = vi.fn();
    const client = {
      lesson: { findMany: vi.fn(async () => []) },
      moduleRun: { findMany: moduleRuns },
    } as unknown as PrismaClient;
    const repository = createPrismaTodayRepository(client);

    await expect(repository.listLessons(userId)).resolves.toEqual([]);
    expect(moduleRuns).not.toHaveBeenCalled();
  });

  it('keeps carryovers only from the latest run of each represented module', async () => {
    const lessons = [
      lesson('module-a', ['run-a-current', 'run-a-old']),
      lesson('module-b', ['run-b-current']),
      lesson('module-a', ['run-a-current']),
    ];
    const moduleRuns = vi.fn(async () => [
      { id: 'run-a-current', moduleId: 'module-a' },
      { id: 'run-a-old', moduleId: 'module-a' },
      { id: 'run-b-current', moduleId: 'module-b' },
    ]);
    const client = {
      lesson: { findMany: vi.fn(async () => lessons) },
      moduleRun: { findMany: moduleRuns },
    } as unknown as PrismaClient;
    const repository = createPrismaTodayRepository(client);

    const result = await repository.listLessons(userId);

    expect(moduleRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moduleId: { in: ['module-a', 'module-b'] }, userId },
      }),
    );
    expect(result.map((item) => item.activityCompletionCarryovers)).toEqual([
      [expect.objectContaining({ moduleRunId: 'run-a-current' })],
      [expect.objectContaining({ moduleRunId: 'run-b-current' })],
      [expect.objectContaining({ moduleRunId: 'run-a-current' })],
    ]);
  });
});
