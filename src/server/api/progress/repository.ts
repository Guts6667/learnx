import type {
  LessonSequenceKind,
  Prisma,
  PrismaClient,
  ResourceProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';

type ProgressClient = PrismaClient | Prisma.TransactionClient;

class PrismaProgressRepository {
  constructor(private readonly client: ProgressClient) {}

  findProgram(programId: string, userId: string) {
    return this.client.program.findFirst({
      where: { id: programId, ...learningProgramWhere(userId) },
      select: { estimatedDurationDays: true, id: true },
    });
  }

  findProgramProgress(programId: string, userId: string) {
    return this.client.programProgress.findUnique({
      where: { userId_programId: { programId, userId } },
    });
  }

  findAccessibleProgramProgress(programId: string, userId: string) {
    return this.client.programProgress.findFirst({
      where: {
        programId,
        userId,
        program: learningProgramWhere(userId),
      },
    });
  }

  upsertProgramProgress(
    input: Parameters<ProgressClient['programProgress']['upsert']>[0],
  ) {
    return this.client.programProgress.upsert(input);
  }

  updateProgramProgress(
    input: Parameters<ProgressClient['programProgress']['update']>[0],
  ) {
    return this.client.programProgress.update(input);
  }

  findStage(stageId: string, userId: string) {
    return this.client.stage.findFirst({
      where: {
        id: stageId,
        isPublished: true,
        program: learningProgramWhere(userId),
      },
      select: { estimatedDurationDays: true, id: true },
    });
  }

  findStageProgress(stageId: string, userId: string) {
    return this.client.stageProgress.findUnique({
      where: { userId_stageId: { stageId, userId } },
    });
  }

  findAccessibleStageProgress(stageId: string, userId: string) {
    return this.client.stageProgress.findFirst({
      where: {
        stageId,
        userId,
        stage: { program: learningProgramWhere(userId) },
      },
    });
  }

  upsertStageProgress(
    input: Parameters<ProgressClient['stageProgress']['upsert']>[0],
  ) {
    return this.client.stageProgress.upsert(input);
  }

  updateStageProgress(
    input: Parameters<ProgressClient['stageProgress']['update']>[0],
  ) {
    return this.client.stageProgress.update(input);
  }

  findSequenceItem(
    lessonId: string,
    userId: string,
    targetField: string,
    targetId: string,
    kind: LessonSequenceKind,
  ) {
    return this.client.lessonSequenceItem.findFirst({
      where: {
        [targetField]: targetId,
        kind,
        lessonId,
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: learningProgramWhere(userId),
            },
          },
        },
      },
      select: { id: true },
    });
  }

  saveLessonLocation(
    lessonId: string,
    userId: string,
    itemId: string,
    now: Date,
  ) {
    return this.client.lessonProgress.upsert({
      where: { userId_lessonId: { lessonId, userId } },
      create: {
        currentSequenceItemId: itemId,
        lastViewedAt: now,
        lessonId,
        startedAt: now,
        status: 'IN_PROGRESS',
        userId,
      },
      update: { currentSequenceItemId: itemId, lastViewedAt: now },
    });
  }

  findTask(taskId: string, userId: string) {
    return this.client.task.findFirst({
      where: {
        id: taskId,
        isCanonical: true,
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: learningProgramWhere(userId),
            },
          },
        },
      },
      select: { id: true, lessonId: true },
    });
  }

  saveTaskStatus(
    taskId: string,
    userId: string,
    status: TaskCompletionStatus,
    now: Date,
  ) {
    const completedAt = status === 'DONE' ? now : null;
    return this.client.taskCompletion.upsert({
      where: { userId_taskId: { taskId, userId } },
      create: { completedAt, status, taskId, userId },
      update: { completedAt, status },
    });
  }

  findResource(resourceId: string, userId: string) {
    return this.client.resource.findFirst({
      where: {
        id: resourceId,
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: learningProgramWhere(userId),
            },
          },
        },
      },
      select: { id: true, lessonId: true },
    });
  }

  saveResourceStatus(
    resourceId: string,
    userId: string,
    status: ResourceProgressStatus,
    now: Date,
  ) {
    const completedAt = status === 'COMPLETED' ? now : null;
    return this.client.resourceProgress.upsert({
      where: { userId_resourceId: { resourceId, userId } },
      create: { completedAt, resourceId, status, userId },
      update: { completedAt, status },
    });
  }
}

export function createProgressRepository(client: ProgressClient) {
  return new PrismaProgressRepository(client);
}
