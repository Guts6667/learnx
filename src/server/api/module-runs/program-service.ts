import {
  StageProgressStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  createPrismaProgramRestartDataRepository,
  type PrismaProgramRestartDataRepository,
} from './program-repository.js';
import type {
  ProgramRestartRepository,
  ProgramRestartResult,
} from './types.js';
import { isUniqueConstraintError } from './validation.js';

type Program = NonNullable<
  Awaited<ReturnType<PrismaProgramRestartDataRepository['readProgram']>>
>;

async function createProgramRuns(
  repository: PrismaProgramRestartDataRepository,
  modules: Array<{ id: string }>,
  existingByModuleId: Map<string, string>,
  restartKey: string,
  userId: string,
) {
  const runIds: string[] = [];
  for (const module of modules) {
    const existingRunId = existingByModuleId.get(module.id);
    if (existingRunId) {
      runIds.push(existingRunId);
      continue;
    }
    let current = await repository.getCurrentRun(module.id, userId);
    if (!current) {
      current = await repository.createRun(module.id, 1, new Date(0), userId);
    }
    const run = await repository.createRun(
      module.id,
      current.sequence + 1,
      new Date(),
      userId,
      restartKey,
    );
    runIds.push(run.id);
  }
  return runIds;
}

async function resetProgramProgress(
  repository: PrismaProgramRestartDataRepository,
  program: Program,
  userId: string,
) {
  const now = new Date();
  await repository.resetLessonProgress(program.id, userId, now);
  for (const [index, stage] of program.stages.entries()) {
    await repository.resetStageProgress(
      stage.id,
      userId,
      index === 0
        ? StageProgressStatus.AVAILABLE
        : StageProgressStatus.LOCKED,
    );
  }
  await repository.resetProgramProgress(program.id, userId, now);
  const firstStage = program.stages[0];
  if (firstStage) {
    await repository.saveViewPreference(program.id, firstStage.id, userId);
  }
}

async function restartInTransaction(
  repository: PrismaProgramRestartDataRepository,
  programId: string,
  restartKey: string,
  userId: string,
): Promise<ProgramRestartResult | null> {
  const program = await repository.readProgram(programId, userId);
  if (!program) return null;
  const modules = program.stages.flatMap((stage) => stage.modules);
  const moduleIds = modules.map((module) => module.id);
  const existingRuns = await repository.findRestartRuns(
    moduleIds,
    restartKey,
    userId,
  );
  if (modules.length > 0 && existingRuns.length === modules.length) {
    const preview = await repository.buildPreview(programId, userId);
    return preview
      ? { ...preview, idempotent: true, runIds: existingRuns.map(({ id }) => id) }
      : null;
  }
  const existingByModuleId = new Map(
    existingRuns.map((run) => [run.moduleId, run.id]),
  );
  const runIds = await createProgramRuns(
    repository,
    modules,
    existingByModuleId,
    restartKey,
    userId,
  );
  await resetProgramProgress(repository, program, userId);
  const preview = await repository.buildPreview(programId, userId);
  return preview ? { ...preview, idempotent: false, runIds } : null;
}

async function recoverConcurrentRestart(
  repository: PrismaProgramRestartDataRepository,
  programId: string,
  restartKey: string,
  userId: string,
  originalError: unknown,
) {
  const program = await repository.readProgram(programId, userId);
  if (!program) return null;
  const moduleIds = program.stages.flatMap((stage) =>
    stage.modules.map((module) => module.id));
  const existingRuns = await repository.findRestartRuns(
    moduleIds,
    restartKey,
    userId,
  );
  if (existingRuns.length !== moduleIds.length) throw originalError;
  const preview = await repository.buildPreview(programId, userId);
  return preview
    ? { ...preview, idempotent: true, runIds: existingRuns.map(({ id }) => id) }
    : null;
}

export function createProgramRestartService(
  repository: PrismaProgramRestartDataRepository,
): ProgramRestartRepository {
  return {
    preview: (programId, userId) => repository.buildPreview(programId, userId),
    async restart(programId, restartKey, userId) {
      try {
        return await repository.runTransaction((transactionRepository) =>
          restartInTransaction(
            transactionRepository,
            programId,
            restartKey,
            userId,
          ),
        );
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        return recoverConcurrentRestart(
          repository,
          programId,
          restartKey,
          userId,
          error,
        );
      }
    },
  };
}

export function createPrismaProgramRestartRepository(client: PrismaClient) {
  return createProgramRestartService(
    createPrismaProgramRestartDataRepository(client),
  );
}
