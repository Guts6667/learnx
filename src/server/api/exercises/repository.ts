import {
  ExerciseSubmissionStatus,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import {
  ensureCurrentModuleRunForLesson,
  getCurrentModuleRunForLesson,
} from '../_lib/module-runs.js';
import type {
  ExerciseRecord,
  ExerciseRepository,
  ExerciseSubmissionRecord,
} from './types.js';
import {
  assertSubmissionEditable,
  assertSubmissionSubmittable,
  exerciseNotFound,
} from './validation.js';

type ExerciseClient = PrismaClient | Prisma.TransactionClient;
type RecalculateProgress = typeof recalculateLessonProgress;

const submissionSelect = {
  contentMarkdown: true,
  createdAt: true,
  exerciseId: true,
  id: true,
  moduleRunId: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  userId: true,
} as const;

function publishedLessonWhere(userId: string) {
  return {
    isPublished: true,
    module: {
      isPublished: true,
      stage: {
        isPublished: true,
        program: learningProgramWhere(userId),
      },
    },
  } as const;
}

function exerciseWhere(exerciseId: string, userId: string) {
  return {
    id: exerciseId,
    isCanonical: true,
    lesson: publishedLessonWhere(userId),
  } as const;
}

function normalizeLanguage(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'en') return 'en-US';
  return locale;
}

function normalizeObjectives(objectives: unknown): string[] {
  return Array.isArray(objectives)
    ? objectives.filter(
        (objective): objective is string => typeof objective === 'string',
      )
    : [];
}

class PrismaExerciseRepository implements ExerciseRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly recalculateProgress: RecalculateProgress,
  ) {}

  createOrGetSubmission(exerciseId: string, userId: string) {
    return runSerializableProgressTransaction(
      this.client,
      async (transaction) => {
        const exercise = await transaction.exercise.findFirst({
          where: exerciseWhere(exerciseId, userId),
          select: { lessonId: true },
        });
        if (!exercise) throw exerciseNotFound();
        const moduleRun = await ensureCurrentModuleRunForLesson(
          transaction,
          exercise.lessonId,
          userId,
          new Date(),
        );
        return transaction.exerciseSubmission.upsert({
          where: {
            userId_exerciseId_moduleRunId: {
              exerciseId,
              moduleRunId: moduleRun.id,
              userId,
            },
          },
          create: { exerciseId, moduleRunId: moduleRun.id, userId },
          update: {},
          select: submissionSelect,
        });
      },
    );
  }

  async findExerciseForUser(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseRecord | null> {
    const exercise = await this.client.exercise.findFirst({
      include: {
        lesson: {
          select: {
            objectives: true,
            slug: true,
            summary: true,
            module: {
              select: {
                stage: {
                  select: {
                    program: { select: { locale: true, slug: true } },
                  },
                },
              },
            },
          },
        },
      },
      where: exerciseWhere(exerciseId, userId),
    });
    if (!exercise) return null;
    const submission = await this.findCurrentSubmission(
      exerciseId,
      exercise.lessonId,
      userId,
    );
    const { lesson, ...exerciseRecord } = exercise;
    return {
      ...exerciseRecord,
      language: normalizeLanguage(lesson.module.stage.program.locale),
      lessonObjectives: normalizeObjectives(lesson.objectives),
      lessonSlug: lesson.slug,
      lessonSummary: lesson.summary,
      programSlug: lesson.module.stage.program.slug,
      submission,
    };
  }

  async findOwnedSubmission(submissionId: string, userId: string) {
    const submission = await this.client.exerciseSubmission.findFirst({
      where: {
        id: submissionId,
        userId,
        exercise: { lesson: publishedLessonWhere(userId) },
      },
      include: { exercise: { select: { lessonId: true } } },
    });
    if (!submission) return null;
    const currentRun = await getCurrentModuleRunForLesson(
      this.client,
      submission.exercise.lessonId,
      userId,
    );
    if (currentRun?.id !== submission.moduleRunId) return null;
    const { exercise: _exercise, ...record } = submission;
    void _exercise;
    return record;
  }

  saveSubmission(
    submissionId: string,
    contentMarkdown: string,
    userId: string,
  ) {
    return runSerializableProgressTransaction(
      this.client,
      async (transaction) => {
        const submission = await this.findTransactionSubmission(
          transaction,
          submissionId,
          userId,
        );
        assertSubmissionEditable(submission);
        await this.assertCurrentRun(transaction, submission, userId);
        return transaction.exerciseSubmission.update({
          where: { id: submissionId },
          data: { contentMarkdown },
          select: submissionSelect,
        });
      },
    );
  }

  submitSubmission(submissionId: string, submittedAt: Date, userId: string) {
    return runSerializableProgressTransaction(
      this.client,
      async (transaction) => {
        const current = await this.findTransactionSubmission(
          transaction,
          submissionId,
          userId,
        );
        assertSubmissionSubmittable(current);
        await this.assertCurrentRun(transaction, current, userId);
        const submission = await transaction.exerciseSubmission.update({
          where: { id: submissionId },
          data: { status: ExerciseSubmissionStatus.SUBMITTED, submittedAt },
          select: submissionSelect,
        });
        const progress = await this.recalculateProgress(
          transaction,
          current.exercise.lessonId,
          userId,
          submittedAt,
          { requirePublished: true },
        );
        if (!progress) throw exerciseNotFound();
        return submission;
      },
    );
  }

  private async assertCurrentRun(
    client: ExerciseClient,
    submission: ExerciseSubmissionRecord & { exercise: { lessonId: string } },
    userId: string,
  ): Promise<void> {
    const currentRun = await getCurrentModuleRunForLesson(
      client,
      submission.exercise.lessonId,
      userId,
    );
    if (currentRun?.id !== submission.moduleRunId) throw exerciseNotFound();
  }

  private async findCurrentSubmission(
    exerciseId: string,
    lessonId: string,
    userId: string,
  ) {
    const moduleRun = await getCurrentModuleRunForLesson(
      this.client,
      lessonId,
      userId,
    );
    if (!moduleRun) return null;
    return this.client.exerciseSubmission.findUnique({
      where: {
        userId_exerciseId_moduleRunId: {
          exerciseId,
          moduleRunId: moduleRun.id,
          userId,
        },
      },
      select: submissionSelect,
    });
  }

  private async findTransactionSubmission(
    client: ExerciseClient,
    submissionId: string,
    userId: string,
  ) {
    const submission = await client.exerciseSubmission.findFirst({
      where: {
        id: submissionId,
        userId,
        exercise: { lesson: publishedLessonWhere(userId) },
      },
      include: { exercise: { select: { lessonId: true } } },
    });
    if (!submission) throw exerciseNotFound();
    return submission;
  }
}

export function createPrismaExerciseRepository(
  client: PrismaClient,
  recalculateProgress = recalculateLessonProgress,
): ExerciseRepository {
  return new PrismaExerciseRepository(client, recalculateProgress);
}
