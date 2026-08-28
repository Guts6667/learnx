import type { PrismaClient } from '../../../../generated/prisma/client.js';
import {
  createPrismaModuleRestartDataRepository,
  type PrismaModuleRestartDataRepository,
} from './module-repository.js';
import type {
  ModuleRestartRepository,
  ModuleRestartResult,
} from './types.js';
import { isUniqueConstraintError } from './validation.js';

async function restartInTransaction(
  repository: PrismaModuleRestartDataRepository,
  moduleId: string,
  restartKey: string,
  userId: string,
): Promise<ModuleRestartResult | null> {
  const module = await repository.readOwnedModule(moduleId, userId);
  if (!module) return null;
  const existing = await repository.findRestartRun(
    moduleId,
    restartKey,
    userId,
  );
  if (existing) {
    const preview = await repository.buildPreview(moduleId, userId);
    return preview ? { ...preview, idempotent: true, runId: existing.id } : null;
  }
  let current = await repository.getCurrentRun(moduleId, userId);
  if (!current) {
    current = await repository.createRun(moduleId, 1, new Date(0), userId);
  }
  const now = new Date();
  const run = await repository.createRun(
    moduleId,
    current.sequence + 1,
    now,
    userId,
    restartKey,
  );
  await repository.resetProgress(moduleId, userId, now);
  await repository.refreshHierarchy(
    module.stage.id,
    module.stage.programId,
    userId,
    now,
  );
  const preview = await repository.buildPreview(moduleId, userId);
  return preview ? { ...preview, idempotent: false, runId: run.id } : null;
}

async function recoverConcurrentRestart(
  repository: PrismaModuleRestartDataRepository,
  moduleId: string,
  restartKey: string,
  userId: string,
  originalError: unknown,
) {
  const existing = await repository.findRestartRun(
    moduleId,
    restartKey,
    userId,
  );
  const preview = existing
    ? await repository.buildPreview(moduleId, userId)
    : null;
  if (!existing || !preview) throw originalError;
  return { ...preview, idempotent: true, runId: existing.id };
}

export function createModuleRestartService(
  repository: PrismaModuleRestartDataRepository,
): ModuleRestartRepository {
  return {
    preview: (moduleId, userId) => repository.buildPreview(moduleId, userId),
    async restart(moduleId, restartKey, userId) {
      try {
        return await repository.runTransaction((transactionRepository) =>
          restartInTransaction(
            transactionRepository,
            moduleId,
            restartKey,
            userId,
          ),
        );
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        return recoverConcurrentRestart(
          repository,
          moduleId,
          restartKey,
          userId,
          error,
        );
      }
    },
  };
}

export function createPrismaModuleRestartRepository(client: PrismaClient) {
  return createModuleRestartService(
    createPrismaModuleRestartDataRepository(client),
  );
}
