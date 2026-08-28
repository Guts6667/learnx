import {
  LessonProgressStatus,
  type Prisma,
} from '../../../../generated/prisma/client.js';
import {
  readLessonState,
  toLessonSnapshot,
} from './progress-recalculation-lesson-snapshot.js';
import { recalculateStageAndProgram } from './progress-recalculation-stage.js';
import type {
  LessonProgressSnapshot,
  RecalculationOptions,
} from './progress-recalculation-types.js';

type LessonState = NonNullable<Awaited<ReturnType<typeof readLessonState>>>;

function hasTrackedActivity(lesson: LessonState): boolean {
  return (
    lesson.concepts.some((item) => item.progress.length > 0) ||
    lesson.exercises.some((item) => item.submissions.length > 0) ||
    lesson.quizzes.some((item) => item._count.attempts > 0) ||
    lesson.resources.some((item) => item.progress.length > 0) ||
    lesson.tasks.some((item) => item.completions.length > 0)
  );
}

function shouldSkipPersistence(
  lesson: LessonState,
  snapshot: LessonProgressSnapshot,
  options: RecalculationOptions,
): boolean {
  if (options.completeRequested === true && !snapshot.canComplete) return true;
  return (
    !snapshot.lessonProgress &&
    !hasTrackedActivity(lesson) &&
    options.startIfMissing === false
  );
}

function getPersistedState(
  snapshot: LessonProgressSnapshot,
  now: Date,
  completeRequested: boolean,
) {
  const current = snapshot.lessonProgress;
  const remainsCompleted =
    current?.status === LessonProgressStatus.COMPLETED && snapshot.canComplete;
  const status =
    completeRequested || remainsCompleted
      ? LessonProgressStatus.COMPLETED
      : LessonProgressStatus.IN_PROGRESS;
  const percent =
    status === LessonProgressStatus.COMPLETED ? 100 : snapshot.percent;
  const completedAt =
    status === LessonProgressStatus.COMPLETED
      ? (current?.completedAt ?? now)
      : null;
  return { completedAt, percent, status };
}

async function persistLessonProgress(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  userId: string,
  snapshot: LessonProgressSnapshot,
  now: Date,
  options: RecalculationOptions,
) {
  const state = getPersistedState(
    snapshot,
    now,
    options.completeRequested === true,
  );
  const progress = await transaction.lessonProgress.upsert({
    where: { userId_lessonId: { lessonId, userId } },
    create: {
      completedAt: state.completedAt,
      lastViewedAt: now,
      lessonId,
      percent: state.percent,
      startedAt: now,
      status: state.status,
      userId,
    },
    update: {
      completedAt: state.completedAt,
      ...(options.preserveTimestamps ? {} : { lastViewedAt: now }),
      percent: state.percent,
      startedAt: snapshot.lessonProgress?.startedAt ?? now,
      status: state.status,
    },
  });
  return { ...snapshot, lessonProgress: progress, percent: state.percent };
}

function isPublishedHierarchy(lesson: LessonState): boolean {
  return (
    lesson.isPublished &&
    lesson.module.isPublished &&
    lesson.module.stage.isPublished
  );
}

export async function recalculateLessonProgress(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  userId: string,
  now: Date,
  options: RecalculationOptions = {},
): Promise<LessonProgressSnapshot | null> {
  const lesson = await readLessonState(
    transaction,
    lessonId,
    userId,
    options.requirePublished ?? false,
  );
  if (!lesson) return null;
  const snapshot = toLessonSnapshot(lesson);
  if (shouldSkipPersistence(lesson, snapshot, options)) return snapshot;
  const persisted = await persistLessonProgress(
    transaction,
    lessonId,
    userId,
    snapshot,
    now,
    options,
  );
  if (isPublishedHierarchy(lesson)) {
    await recalculateStageAndProgram(
      transaction,
      lesson.module.stage.id,
      lesson.module.stage.programId,
      userId,
      now,
      new Map([[lessonId, persisted]]),
      options.preserveTimestamps,
    );
  }
  return persisted;
}
