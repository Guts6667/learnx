import { calculateTargetEndDate } from '../../../lib/timeline.js';
import { ApiError } from '../_lib/errors.js';
import { createProgressRepository } from './repository.js';
import { serializeTimeline } from './serialization.js';
import type {
  LessonLocationInput,
  ProgressResourceStatus,
  ProgressServiceOptions,
  ProgressTaskStatus,
} from './types.js';
import { assertTargetAfterStart, progressNotFound } from './validation.js';

async function startProgram(
  options: ProgressServiceOptions,
  programId: string,
  userId: string,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const repository = createProgressRepository(transaction);
    const program = await repository.findProgram(programId, userId);
    if (!program) throw progressNotFound();
    const [currentProgress, currentTimeline] = await Promise.all([
      repository.findProgramProgress(programId, userId),
      options.readProgramTimeline(transaction, programId, userId, now),
    ]);
    const startedAt = currentProgress?.startedAt ?? now;
    const targetEndAt =
      currentProgress?.targetEndAt ??
      calculateTargetEndDate(startedAt, program.estimatedDurationDays);
    const progress = await repository.upsertProgramProgress({
      where: { userId_programId: { programId, userId } },
      create: {
        lastViewedAt: now,
        percent: currentTimeline?.actualPercent ?? 0,
        programId,
        startedAt,
        targetEndAt,
        userId,
      },
      update: {
        lastViewedAt: now,
        percent: currentTimeline?.actualPercent ?? 0,
        startedAt,
        targetEndAt,
      },
    });
    return { timeline: serializeTimeline(progress.percent, progress, now) };
  });
}

async function scheduleProgram(
  options: ProgressServiceOptions,
  programId: string,
  userId: string,
  targetEndAt: Date,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const repository = createProgressRepository(transaction);
    const current = await repository.findAccessibleProgramProgress(
      programId,
      userId,
    );
    if (!current) throw progressNotFound();
    if (!current.startedAt) {
      throw new ApiError(
        'TIMELINE_NOT_STARTED',
        'Start this program before changing its target date.',
        409,
      );
    }
    assertTargetAfterStart(current.startedAt, targetEndAt);
    const currentTimeline = await options.readProgramTimeline(
      transaction,
      programId,
      userId,
      now,
    );
    const progress = await repository.updateProgramProgress({
      where: { userId_programId: { programId, userId } },
      data: { lastViewedAt: now, targetEndAt },
    });
    return {
      timeline: serializeTimeline(
        currentTimeline?.actualPercent ?? progress.percent,
        progress,
        now,
      ),
    };
  });
}

async function startStage(
  options: ProgressServiceOptions,
  stageId: string,
  userId: string,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const repository = createProgressRepository(transaction);
    const stage = await repository.findStage(stageId, userId);
    if (!stage) throw progressNotFound();
    const [currentProgress, currentTimeline] = await Promise.all([
      repository.findStageProgress(stageId, userId),
      options.readStageTimeline(transaction, stageId, userId, now),
    ]);
    const startedAt = currentProgress?.startedAt ?? now;
    const targetEndAt =
      currentProgress?.targetEndAt ??
      calculateTargetEndDate(startedAt, stage.estimatedDurationDays);
    const progress = await repository.upsertStageProgress({
      where: { userId_stageId: { stageId, userId } },
      create: {
        lastViewedAt: now,
        percent: currentTimeline?.actualPercent ?? 0,
        stageId,
        startedAt,
        status: 'IN_PROGRESS',
        targetEndAt,
        userId,
      },
      update: {
        lastViewedAt: now,
        percent: currentTimeline?.actualPercent ?? 0,
        startedAt,
        status:
          currentProgress?.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
        targetEndAt,
      },
    });
    return {
      status: progress.status,
      timeline: serializeTimeline(progress.percent, progress, now),
    };
  });
}

async function scheduleStage(
  options: ProgressServiceOptions,
  stageId: string,
  userId: string,
  targetEndAt: Date,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const repository = createProgressRepository(transaction);
    const current = await repository.findAccessibleStageProgress(
      stageId,
      userId,
    );
    if (!current) throw progressNotFound();
    if (!current.startedAt) {
      throw new ApiError(
        'TIMELINE_NOT_STARTED',
        'Start this stage before changing its target date.',
        409,
      );
    }
    assertTargetAfterStart(current.startedAt, targetEndAt);
    const currentTimeline = await options.readStageTimeline(
      transaction,
      stageId,
      userId,
      now,
    );
    const progress = await repository.updateStageProgress({
      where: { userId_stageId: { stageId, userId } },
      data: { lastViewedAt: now, targetEndAt },
    });
    return {
      status: progress.status,
      timeline: serializeTimeline(
        currentTimeline?.actualPercent ?? progress.percent,
        progress,
        now,
      ),
    };
  });
}

async function saveLessonLocation(
  options: ProgressServiceOptions,
  lessonId: string,
  userId: string,
  input: LessonLocationInput,
  now: Date,
) {
  const repository = createProgressRepository(options.client);
  const targetField = {
    CONCEPT_ASSESSMENT: 'conceptAssessmentId',
    CONTENT: 'contentBlockId',
    EXERCISE: 'exerciseId',
    QUIZ: 'quizId',
    RESOURCE: 'resourceId',
    TASK: 'taskId',
  }[input.kind];
  const item = await repository.findSequenceItem(
    lessonId,
    userId,
    targetField,
    input.id,
    input.kind,
  );
  if (!item) throw progressNotFound();
  await repository.saveLessonLocation(lessonId, userId, item.id, now);
  const snapshot = await options.readLessonSnapshot(
    options.client,
    lessonId,
    userId,
  );
  if (!snapshot) throw progressNotFound();
  return snapshot;
}

async function updateTask(
  options: ProgressServiceOptions,
  taskId: string,
  userId: string,
  status: ProgressTaskStatus,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const repository = createProgressRepository(transaction);
    const task = await repository.findTask(taskId, userId);
    if (!task) throw progressNotFound();
    await repository.saveTaskStatus(taskId, userId, status, now);
    const snapshot = await options.recalculateLesson(
      transaction,
      task.lessonId,
      userId,
      now,
      { requirePublished: true },
    );
    if (!snapshot) throw progressNotFound();
    return snapshot;
  });
}

async function updateResource(
  options: ProgressServiceOptions,
  resourceId: string,
  userId: string,
  status: ProgressResourceStatus,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const repository = createProgressRepository(transaction);
    const resource = await repository.findResource(resourceId, userId);
    if (!resource) throw progressNotFound();
    await repository.saveResourceStatus(resourceId, userId, status, now);
    const snapshot = await options.recalculateLesson(
      transaction,
      resource.lessonId,
      userId,
      now,
      { requirePublished: true },
    );
    if (!snapshot) throw progressNotFound();
    return snapshot;
  });
}

async function completeLesson(
  options: ProgressServiceOptions,
  lessonId: string,
  userId: string,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const snapshot = await options.recalculateLesson(
      transaction,
      lessonId,
      userId,
      now,
      { completeRequested: true, requirePublished: true },
    );
    if (!snapshot) throw progressNotFound();
    if (!snapshot.canComplete) {
      throw new ApiError(
        'LESSON_NOT_READY',
        'Complete the tracked activities before completing this lesson.',
        409,
      );
    }
    return snapshot;
  });
}

async function getLessonProgress(
  options: ProgressServiceOptions,
  lessonId: string,
  userId: string,
) {
  const snapshot = await options.readLessonSnapshot(
    options.client,
    lessonId,
    userId,
  );
  if (!snapshot) throw progressNotFound();
  return snapshot;
}

async function startLesson(
  options: ProgressServiceOptions,
  lessonId: string,
  userId: string,
  now: Date,
) {
  return options.runTransaction(options.client, async (transaction) => {
    const snapshot = await options.recalculateLesson(
      transaction,
      lessonId,
      userId,
      now,
      { requirePublished: true },
    );
    if (!snapshot) throw progressNotFound();
    return snapshot;
  });
}

export function createProgressService(options: ProgressServiceOptions) {
  return {
    completeLesson: (lessonId: string, userId: string, now: Date) =>
      completeLesson(options, lessonId, userId, now),
    getLessonProgress: (lessonId: string, userId: string) =>
      getLessonProgress(options, lessonId, userId),
    saveLessonLocation: (
      lessonId: string,
      userId: string,
      input: LessonLocationInput,
      now: Date,
    ) => saveLessonLocation(options, lessonId, userId, input, now),
    scheduleProgram: (
      programId: string,
      userId: string,
      targetEndAt: Date,
      now: Date,
    ) => scheduleProgram(options, programId, userId, targetEndAt, now),
    scheduleStage: (
      stageId: string,
      userId: string,
      targetEndAt: Date,
      now: Date,
    ) => scheduleStage(options, stageId, userId, targetEndAt, now),
    startLesson: (lessonId: string, userId: string, now: Date) =>
      startLesson(options, lessonId, userId, now),
    startProgram: (programId: string, userId: string, now: Date) =>
      startProgram(options, programId, userId, now),
    startStage: (stageId: string, userId: string, now: Date) =>
      startStage(options, stageId, userId, now),
    updateResource: (
      resourceId: string,
      userId: string,
      status: ProgressResourceStatus,
      now: Date,
    ) => updateResource(options, resourceId, userId, status, now),
    updateTask: (
      taskId: string,
      userId: string,
      status: ProgressTaskStatus,
      now: Date,
    ) => updateTask(options, taskId, userId, status, now),
  };
}
