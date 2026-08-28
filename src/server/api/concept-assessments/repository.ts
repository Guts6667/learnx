import {
  ConceptProgressStatus,
  type Prisma,
  type PrismaClient,
  ReviewSourceType,
  ReviewStatus,
} from '../../../../generated/prisma/client.js';
import {
  encodeCursor,
  InvalidCursorError,
  parseCursor,
  toCursorPage,
} from '../_lib/cursor-pagination.js';
import { ensureCurrentModuleRunForLesson } from '../_lib/module-runs.js';
import {
  learningOrPreviewProgramWhere,
  learningProgramWhere,
  previewProgramWhere,
} from '../_lib/program-access-policy.js';
import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import type {
  ConceptAssessmentRepository,
  RecordAttemptInput,
} from './types.js';
import { assessmentNotFound } from './validation.js';

type RecalculateProgress = typeof recalculateLessonProgress;

async function assertAccessibleAssessment(
  transaction: Prisma.TransactionClient,
  input: RecordAttemptInput,
) {
  const publication = input.preview ? {} : { isPublished: true };
  const assessment = await transaction.conceptAssessment.findFirst({
    where: {
      conceptId: input.conceptId,
      id: input.assessmentId,
      concept: {
        lesson: {
          id: input.lessonId,
          ...publication,
          module: {
            ...publication,
            stage: {
              ...publication,
              program: {
                id: input.programId,
                ...learningOrPreviewProgramWhere(input.userId, input.preview),
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  if (!assessment) throw assessmentNotFound();
}

function getProgressWrite(
  current: Awaited<
    ReturnType<Prisma.TransactionClient['conceptProgress']['findUnique']>
  >,
  input: RecordAttemptInput,
) {
  const bestScore = Math.max(current?.bestScore ?? 0, input.score);
  const wasValidated = current?.status === ConceptProgressStatus.VALIDATED;
  return {
    bestScore,
    status: input.passed || wasValidated
      ? ConceptProgressStatus.VALIDATED
      : ConceptProgressStatus.NEEDS_REVIEW,
    validatedAt: input.passed
      ? input.submittedAt
      : (current?.validatedAt ?? null),
  };
}

async function writeAttemptAndProgress(
  transaction: Prisma.TransactionClient,
  input: RecordAttemptInput,
  moduleRunId: string,
) {
  const current = await transaction.conceptProgress.findUnique({
    where: {
      userId_conceptId: { conceptId: input.conceptId, userId: input.userId },
    },
  });
  const progressWrite = getProgressWrite(current, input);
  return Promise.all([
    transaction.conceptAssessmentAttempt.create({
      data: {
        answers: input.answers,
        assessmentId: input.assessmentId,
        moduleRunId,
        passed: input.passed,
        score: input.score,
        submittedAt: input.submittedAt,
        userId: input.userId,
      },
    }),
    transaction.conceptProgress.upsert({
      where: {
        userId_conceptId: { conceptId: input.conceptId, userId: input.userId },
      },
      create: {
        ...progressWrite,
        conceptId: input.conceptId,
        lastAttemptAt: input.submittedAt,
        userId: input.userId,
      },
      update: { ...progressWrite, lastAttemptAt: input.submittedAt },
    }),
  ]);
}

async function syncReviewItem(
  transaction: Prisma.TransactionClient,
  input: RecordAttemptInput,
) {
  const key = {
    sourceId: input.assessmentId,
    sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
    userId: input.userId,
  } as const;
  if (input.passed) {
    await transaction.reviewItem.updateMany({
      where: key,
      data: { completedAt: input.submittedAt, status: ReviewStatus.COMPLETED },
    });
    return;
  }
  await transaction.reviewItem.upsert({
    where: { userId_sourceType_sourceId: key },
    create: {
      dueAt: input.dueAt,
      lessonId: input.lessonId,
      programId: input.programId,
      ...key,
      status: ReviewStatus.PENDING,
    },
    update: {
      completedAt: null,
      dueAt: input.dueAt,
      status: ReviewStatus.PENDING,
    },
  });
}

async function recordAttemptTransaction(
  transaction: Prisma.TransactionClient,
  input: RecordAttemptInput,
  recalculateProgress: RecalculateProgress,
) {
  await assertAccessibleAssessment(transaction, input);
  const moduleRun = await ensureCurrentModuleRunForLesson(
    transaction,
    input.lessonId,
    input.userId,
    input.submittedAt,
  );
  const [attempt, progress] = await writeAttemptAndProgress(
    transaction,
    input,
    moduleRun.id,
  );
  await syncReviewItem(transaction, input);
  const lessonProgress = await recalculateProgress(
    transaction,
    input.lessonId,
    input.userId,
    input.submittedAt,
    { requirePublished: !input.preview },
  );
  if (!lessonProgress) throw assessmentNotFound();
  return { attempt: { ...attempt, runSequence: moduleRun.sequence }, progress };
}

class PrismaConceptAssessmentRepository
  implements ConceptAssessmentRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly recalculateProgress: RecalculateProgress,
  ) {}

  async findAssessmentForUser(
    assessmentId: string,
    userId: string,
    preview: boolean,
  ) {
    const assessment = await this.client.conceptAssessment.findFirst({
      where: {
        id: assessmentId,
        concept: {
          lesson: {
            ...(preview ? {} : { isPublished: true }),
            module: {
              ...(preview ? {} : { isPublished: true }),
              stage: {
                ...(preview ? {} : { isPublished: true }),
                program: preview
                  ? previewProgramWhere(userId)
                  : learningProgramWhere(userId),
              },
            },
          },
        },
      },
      include: {
        concept: {
          include: {
            lesson: {
              select: {
                id: true,
                module: { select: { stage: { select: { id: true, programId: true } } } },
              },
            },
          },
        },
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!assessment) return null;
    return {
      concept: {
        id: assessment.concept.id,
        lessonId: assessment.concept.lesson.id,
        masteryThreshold: assessment.concept.masteryThreshold,
        programId: assessment.concept.lesson.module.stage.programId,
        stageId: assessment.concept.lesson.module.stage.id,
        title: assessment.concept.title,
      },
      id: assessment.id,
      isRequired: assessment.isRequired,
      position: assessment.position,
      questions: assessment.questions,
      title: assessment.title,
    };
  }

  async listAttempts(input: Parameters<ConceptAssessmentRepository['listAttempts']>[0]) {
    const publication = input.preview ? {} : { isPublished: true };
    const context = `${input.userId}:${input.assessmentId}:${input.preview}`;
    const cursor = parseCursor(input.cursor, 'concept-assessment-attempts', context);
    const cursorDate = cursor ? new Date(cursor.value) : undefined;
    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new InvalidCursorError();
    }
    const attempts = await this.client.conceptAssessmentAttempt.findMany({
      where: {
        assessmentId: input.assessmentId,
        userId: input.userId,
        assessment: {
          concept: {
            lesson: {
              ...publication,
              module: {
                ...publication,
                stage: {
                  ...publication,
                  program: learningOrPreviewProgramWhere(input.userId, input.preview),
                },
              },
            },
          },
        },
        ...(cursor && cursorDate ? {
          OR: [
            { submittedAt: { lt: cursorDate } },
            { id: { lt: cursor.id }, submittedAt: cursorDate },
          ],
        } : {}),
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      include: { moduleRun: { select: { sequence: true } } },
      take: input.pageSize + 1,
    });
    const page = toCursorPage(attempts, input.pageSize, (attempt) =>
      encodeCursor('concept-assessment-attempts', context, {
        id: attempt.id,
        value: attempt.submittedAt.toISOString(),
      }));
    return {
      items: page.items.map(({ moduleRun, ...attempt }) => ({
        ...attempt,
        runSequence: moduleRun.sequence,
      })),
      nextCursor: page.nextCursor,
    };
  }

  recordAttempt(input: RecordAttemptInput) {
    return runSerializableProgressTransaction(this.client, (transaction) =>
      recordAttemptTransaction(transaction, input, this.recalculateProgress));
  }
}

export function createPrismaRepository(
  client: PrismaClient,
  recalculateProgress = recalculateLessonProgress,
): ConceptAssessmentRepository {
  return new PrismaConceptAssessmentRepository(client, recalculateProgress);
}
