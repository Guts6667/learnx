import type {
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  ensureCurrentModuleRunForLesson,
  getCurrentModuleRun,
  getCurrentModuleRunForLesson,
} from './module-runs.js';

const lessonId = '11111111-1111-4111-8111-111111111111';
const moduleId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-08-28T09:00:00.000Z');
const run = { id: 'run-id', moduleId, sequence: 1, startedAt: now, userId };

describe('current module run resolution', () => {
  it('selects the latest run for a module', async () => {
    const findFirst = vi.fn(async () => run);
    const client = { moduleRun: { findFirst } } as unknown as PrismaClient;

    await expect(getCurrentModuleRun(client, moduleId, userId)).resolves.toBe(run);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sequence: 'desc' },
        where: { moduleId, userId },
      }),
    );
  });

  it('returns null when the lesson cannot identify a module', async () => {
    const client = {
      lesson: { findUnique: vi.fn(async () => null) },
      moduleRun: { findFirst: vi.fn() },
    } as unknown as PrismaClient;

    await expect(
      getCurrentModuleRunForLesson(client, lessonId, userId),
    ).resolves.toBeNull();
    expect(client.moduleRun.findFirst).not.toHaveBeenCalled();
  });

  it('reuses the current run before attempting an upsert', async () => {
    const client = {
      lesson: { findUnique: vi.fn(async () => ({ moduleId })) },
      moduleRun: {
        findFirst: vi.fn(async () => run),
        upsert: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      ensureCurrentModuleRunForLesson(client, lessonId, userId, now),
    ).resolves.toBe(run);
    expect(client.moduleRun.upsert).not.toHaveBeenCalled();
  });

  it('creates sequence one idempotently when no current run exists', async () => {
    const upsert = vi.fn(async () => run);
    const client = {
      lesson: { findUnique: vi.fn(async () => ({ moduleId })) },
      moduleRun: { findFirst: vi.fn(async () => null), upsert },
    } as unknown as Prisma.TransactionClient;

    await expect(
      ensureCurrentModuleRunForLesson(client, lessonId, userId, now),
    ).resolves.toBe(run);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { moduleId, sequence: 1, startedAt: now, userId },
        where: {
          userId_moduleId_sequence: { moduleId, sequence: 1, userId },
        },
      }),
    );
  });

  it('fails explicitly when a run is requested for an unknown lesson', async () => {
    const client = {
      lesson: { findUnique: vi.fn(async () => null) },
      moduleRun: { findFirst: vi.fn(), upsert: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      ensureCurrentModuleRunForLesson(client, lessonId, userId, now),
    ).rejects.toThrow('Lesson not found while resolving module run.');
  });
});
