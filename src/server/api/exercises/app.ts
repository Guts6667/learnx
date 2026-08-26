import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ExerciseSubmissionStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  assertExerciseSubmissionCanBeEdited,
  assertExerciseSubmissionCanBeSubmitted,
  type ExerciseSubmissionState,
} from '../../../lib/exercises.js';
import { resolveExerciseCorrectionContract } from '../../../lib/exercise-correction-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from '../../corrections/promoted-identity.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import {
  assertCapability,
  requireCapability,
} from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import {
  ensureCurrentModuleRunForLesson,
  getCurrentModuleRunForLesson,
} from '../_lib/module-runs.js';

type SubmissionStatus = keyof typeof ExerciseSubmissionStatus;

interface ExerciseSubmissionRecord {
  contentMarkdown: string;
  createdAt: Date;
  exerciseId: string;
  id: string;
  moduleRunId: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  userId: string;
}

interface ExerciseRecord {
  activityType: string;
  id: string;
  instructions: string;
  isRequired: boolean;
  key: string;
  language?: string;
  lessonObjectives: string[];
  lessonSlug: string;
  lessonSummary: string;
  lessonId: string;
  position: number;
  programSlug: string;
  rubric: unknown;
  submission: ExerciseSubmissionRecord | null;
  title: string;
}

export interface ExerciseRepository {
  createOrGetSubmission(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
  findExerciseForUser(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseRecord | null>;
  findOwnedSubmission(
    submissionId: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord | null>;
  saveSubmission(
    submissionId: string,
    contentMarkdown: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
  submitSubmission(
    submissionId: string,
    submittedAt: Date,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
}

interface ExercisesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: ExerciseRepository;
}

const identifierSchema = z.uuid();
const saveSchema = z.object({
  contentMarkdown: z.string().max(100_000),
});

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function conflict(message: string): ApiError {
  return new ApiError('INVALID_SUBMISSION_STATE', message, 409);
}

function parseIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);

  if (!result.success) throw invalidRequest();

  return result.data;
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

function serializeSubmission(submission: ExerciseSubmissionRecord) {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt.toISOString(),
  };
}

export function isExerciseAiCorrectionEligible(
  exercise: Omit<ExerciseRecord, 'submission'>,
): boolean {
  if (!exercise.language) return false;
  const eligibility = resolveExerciseCorrectionContract({
    activityKey: exercise.key,
    activityType: exercise.activityType,
    explicitContract: exercise.rubric,
    instructions: exercise.instructions,
    language: exercise.language,
    lessonObjectives: exercise.lessonObjectives,
    lessonSlug: exercise.lessonSlug,
    lessonSummary: exercise.lessonSummary,
    programSlug: exercise.programSlug,
    title: exercise.title,
  });
  return (
    eligibility.eligible &&
    PROMOTED_CORRECTION_IDENTITY.languageScope.some(
      (allowedLanguage) => allowedLanguage === exercise.language,
    ) &&
    eligibility.contract.target.kind === 'EXERCISE' &&
    PROMOTED_CORRECTION_IDENTITY.activityTypeScope.some(
      (activityType) =>
        activityType === eligibility.contract.target.activityType,
    )
  );
}

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

export function createPrismaExerciseRepository(
  client: PrismaClient,
  recalculateProgress = recalculateLessonProgress,
): ExerciseRepository {
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

  return {
    async createOrGetSubmission(exerciseId, userId) {
      return runSerializableProgressTransaction(client, async (transaction) => {
        const exercise = await transaction.exercise.findFirst({
          where: exerciseWhere(exerciseId, userId),
          select: { lessonId: true },
        });
        if (!exercise) throw notFound();
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
      });
    },
    async findExerciseForUser(exerciseId, userId) {
      const exercise = await client.exercise.findFirst({
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
      const moduleRun = await getCurrentModuleRunForLesson(
        client,
        exercise.lessonId,
        userId,
      );
      const submission = moduleRun
        ? await client.exerciseSubmission.findUnique({
            where: {
              userId_exerciseId_moduleRunId: {
                exerciseId,
                moduleRunId: moduleRun.id,
                userId,
              },
            },
            select: submissionSelect,
          })
        : null;
      const { lesson, ...exerciseRecord } = exercise;
      const language =
        lesson.module.stage.program.locale === 'fr'
          ? 'fr-FR'
          : lesson.module.stage.program.locale === 'en'
            ? 'en-US'
            : lesson.module.stage.program.locale;
      const objectives = Array.isArray(lesson.objectives)
        ? lesson.objectives.filter(
            (objective): objective is string => typeof objective === 'string',
          )
        : [];
      return {
        ...exerciseRecord,
        language,
        lessonObjectives: objectives,
        lessonSlug: lesson.slug,
        lessonSummary: lesson.summary,
        programSlug: lesson.module.stage.program.slug,
        submission,
      };
    },
    async findOwnedSubmission(submissionId, userId) {
      const submission = await client.exerciseSubmission.findFirst({
        where: {
          id: submissionId,
          userId,
          exercise: { lesson: publishedLessonWhere(userId) },
        },
        include: {
          exercise: { select: { lessonId: true } },
        },
      });
      if (!submission) return null;
      const currentRun = await getCurrentModuleRunForLesson(
        client,
        submission.exercise.lessonId,
        userId,
      );
      if (currentRun?.id !== submission.moduleRunId) return null;
      const { exercise: _exercise, ...record } = submission;
      void _exercise;
      return record;
    },
    async saveSubmission(submissionId, contentMarkdown, userId) {
      return runSerializableProgressTransaction(client, async (transaction) => {
        const submission = await transaction.exerciseSubmission.findFirst({
          where: {
            id: submissionId,
            userId,
            exercise: { lesson: publishedLessonWhere(userId) },
          },
          include: { exercise: { select: { lessonId: true } } },
        });
        if (!submission) throw notFound();
        try {
          assertExerciseSubmissionCanBeEdited(
            submission.status as ExerciseSubmissionState,
          );
        } catch (error) {
          throw conflict(error instanceof Error ? error.message : 'Conflict.');
        }
        const currentRun = await getCurrentModuleRunForLesson(
          transaction,
          submission.exercise.lessonId,
          userId,
        );
        if (currentRun?.id !== submission.moduleRunId) throw notFound();
        return transaction.exerciseSubmission.update({
          where: { id: submissionId },
          data: { contentMarkdown },
          select: submissionSelect,
        });
      });
    },
    async submitSubmission(submissionId, submittedAt, userId) {
      return runSerializableProgressTransaction(client, async (transaction) => {
        const currentSubmission =
          await transaction.exerciseSubmission.findFirst({
            where: {
              id: submissionId,
              userId,
              exercise: { lesson: publishedLessonWhere(userId) },
            },
            include: { exercise: { select: { lessonId: true } } },
          });
        if (!currentSubmission) throw notFound();
        try {
          assertExerciseSubmissionCanBeSubmitted({
            contentMarkdown: currentSubmission.contentMarkdown,
            status: currentSubmission.status as ExerciseSubmissionState,
          });
        } catch (error) {
          throw conflict(error instanceof Error ? error.message : 'Conflict.');
        }
        const currentRun = await getCurrentModuleRunForLesson(
          transaction,
          currentSubmission.exercise.lessonId,
          userId,
        );
        if (currentRun?.id !== currentSubmission.moduleRunId) throw notFound();
        const submission = await transaction.exerciseSubmission.update({
          where: { id: submissionId },
          data: { status: ExerciseSubmissionStatus.SUBMITTED, submittedAt },
          select: submissionSelect,
        });
        const progress = await recalculateProgress(
          transaction,
          currentSubmission.exercise.lessonId,
          userId,
          submittedAt,
          { requirePublished: true },
        );

        if (!progress) throw notFound();

        return submission;
      });
    },
  };
}

async function getPrismaRepository(): Promise<ExerciseRepository> {
  const { prisma } = await import('../../prisma.js');

  return createPrismaExerciseRepository(prisma);
}

export function createExercisesApp(options: ExercisesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  let defaultRepository: ExerciseRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= await getPrismaRepository();
    return defaultRepository;
  };

  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/exercises/:exerciseId', async (context) => {
    const exerciseId = parseIdentifier(context.req.param('exerciseId'));
    const exercise = await (
      await getRepository()
    ).findExerciseForUser(exerciseId, context.get('user').id);

    if (!exercise) throw notFound();

    return context.json({
      exercise: {
        ...exercise,
        aiCorrectionEligible: isExerciseAiCorrectionEligible(exercise),
        submission: exercise.submission
          ? serializeSubmission(exercise.submission)
          : null,
      },
    });
  });

  app.post('/api/exercises/:exerciseId/submissions', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const exerciseId = parseIdentifier(context.req.param('exerciseId'));
    const userId = context.get('user').id;
    const repository = await getRepository();
    const exercise = await repository.findExerciseForUser(exerciseId, userId);

    if (!exercise) throw notFound();

    const submission = await repository.createOrGetSubmission(
      exerciseId,
      userId,
    );

    return context.json({ submission: serializeSubmission(submission) }, 201);
  });

  app.patch('/api/exercise-submissions/:submissionId', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const submissionId = parseIdentifier(context.req.param('submissionId'));
    const parsed = saveSchema.safeParse(await parseJson(context.req.raw));

    if (!parsed.success) throw invalidRequest();

    const repository = await getRepository();
    const submission = await repository.findOwnedSubmission(
      submissionId,
      context.get('user').id,
    );

    if (!submission) throw notFound();

    try {
      assertExerciseSubmissionCanBeEdited(
        submission.status as ExerciseSubmissionState,
      );
    } catch (error) {
      throw conflict(error instanceof Error ? error.message : 'Conflict.');
    }

    const updated = await repository.saveSubmission(
      submissionId,
      parsed.data.contentMarkdown,
      context.get('user').id,
    );
    return context.json({ submission: serializeSubmission(updated) });
  });

  app.post(
    '/api/exercise-submissions/:submissionId/submit',
    async (context) => {
      assertCapability(context.get('user').role, 'learning.write.own');
      const submissionId = parseIdentifier(context.req.param('submissionId'));
      const repository = await getRepository();
      const submission = await repository.findOwnedSubmission(
        submissionId,
        context.get('user').id,
      );

      if (!submission) throw notFound();

      try {
        assertExerciseSubmissionCanBeSubmitted({
          contentMarkdown: submission.contentMarkdown,
          status: submission.status as ExerciseSubmissionState,
        });
      } catch (error) {
        throw conflict(error instanceof Error ? error.message : 'Conflict.');
      }

      const updated = await repository.submitSubmission(
        submissionId,
        now(),
        context.get('user').id,
      );
      return context.json({ submission: serializeSubmission(updated) });
    },
  );

  return app;
}

export const exercisesApp = createExercisesApp();
