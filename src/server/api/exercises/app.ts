import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ExerciseSubmissionStatus,
  ProgramStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  assertExerciseSubmissionCanBeEdited,
  assertExerciseSubmissionCanBeSubmitted,
  type ExerciseSubmissionState,
} from '../../../lib/exercises.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';

type SubmissionStatus = keyof typeof ExerciseSubmissionStatus;

interface ExerciseSubmissionRecord {
  contentMarkdown: string;
  createdAt: Date;
  exerciseId: string;
  id: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  userId: string;
}

interface ExerciseRecord {
  id: string;
  instructions: string;
  isRequired: boolean;
  lessonId: string;
  position: number;
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

function publishedLessonWhere(userId: string) {
  return {
    isPublished: true,
    module: {
      isPublished: true,
      stage: {
        isPublished: true,
        program: { ownerId: userId, status: ProgramStatus.ACTIVE },
      },
    },
  } as const;
}

function exerciseWhere(exerciseId: string, userId: string) {
  return {
    id: exerciseId,
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
    status: true,
    submittedAt: true,
    updatedAt: true,
    userId: true,
  } as const;

  return {
    async createOrGetSubmission(exerciseId, userId) {
      return client.exerciseSubmission.upsert({
        where: { userId_exerciseId: { exerciseId, userId } },
        create: { exerciseId, userId },
        update: {},
        select: submissionSelect,
      });
    },
    async findExerciseForUser(exerciseId, userId) {
      const exercise = await client.exercise.findFirst({
        where: exerciseWhere(exerciseId, userId),
        include: {
          submissions: {
            where: { userId },
            take: 1,
            select: submissionSelect,
          },
        },
      });

      if (!exercise) return null;

      const { submissions, ...exerciseData } = exercise;
      return { ...exerciseData, submission: submissions[0] ?? null };
    },
    async findOwnedSubmission(submissionId, userId) {
      return client.exerciseSubmission.findFirst({
        where: {
          id: submissionId,
          userId,
          exercise: { lesson: publishedLessonWhere(userId) },
        },
        select: submissionSelect,
      });
    },
    async saveSubmission(submissionId, contentMarkdown) {
      return client.exerciseSubmission.update({
        where: { id: submissionId },
        data: { contentMarkdown },
        select: submissionSelect,
      });
    },
    async submitSubmission(submissionId, submittedAt, userId) {
      return runSerializableProgressTransaction(client, async (transaction) => {
        const submission = await transaction.exerciseSubmission.update({
          where: { id: submissionId },
          data: { status: ExerciseSubmissionStatus.SUBMITTED, submittedAt },
          select: submissionSelect,
        });
        const exercise = await transaction.exercise.findUnique({
          where: { id: submission.exerciseId },
          select: { lessonId: true },
        });

        if (!exercise) throw notFound();

        const progress = await recalculateProgress(
          transaction,
          exercise.lessonId,
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
        submission: exercise.submission
          ? serializeSubmission(exercise.submission)
          : null,
      },
    });
  });

  app.post('/api/exercises/:exerciseId/submissions', async (context) => {
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
    );
    return context.json({ submission: serializeSubmission(updated) });
  });

  app.post(
    '/api/exercise-submissions/:submissionId/submit',
    async (context) => {
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
