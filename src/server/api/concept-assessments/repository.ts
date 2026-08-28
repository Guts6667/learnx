import {
  ConceptProgressStatus,
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
import type { ConceptAssessmentRepository } from './types.js';
import { assessmentNotFound } from './validation.js';

export function createPrismaRepository(
  client: PrismaClient,
  recalculateProgress = recalculateLessonProgress,
): ConceptAssessmentRepository {
  return {
    async findAssessmentForUser(assessmentId, userId, preview) {
      const assessment = await client.conceptAssessment.findFirst({
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
                  module: {
                    select: {
                      stage: { select: { id: true, programId: true } },
                    },
                  },
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
    },
    async listAttempts(input) {
      const publicationFilter = input.preview ? {} : { isPublished: true };
      const context = `${input.userId}:${input.assessmentId}:${input.preview}`;
      const cursor = parseCursor(
        input.cursor,
        'concept-assessment-attempts',
        context,
      );
      const cursorDate = cursor ? new Date(cursor.value) : undefined;
      if (cursorDate && Number.isNaN(cursorDate.getTime())) {
        throw new InvalidCursorError();
      }
      const attempts = await client.conceptAssessmentAttempt.findMany({
        where: {
          assessmentId: input.assessmentId,
          userId: input.userId,
          assessment: {
            concept: {
              lesson: {
                ...publicationFilter,
                module: {
                  ...publicationFilter,
                  stage: {
                    ...publicationFilter,
                    program: learningOrPreviewProgramWhere(
                      input.userId,
                      input.preview,
                    ),
                  },
                },
              },
            },
          },
          ...(cursor && cursorDate
            ? {
                OR: [
                  { submittedAt: { lt: cursorDate } },
                  { id: { lt: cursor.id }, submittedAt: cursorDate },
                ],
              }
            : {}),
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        include: { moduleRun: { select: { sequence: true } } },
        take: input.pageSize + 1,
      });
      const page = toCursorPage(attempts, input.pageSize, (attempt) =>
        encodeCursor('concept-assessment-attempts', context, {
          id: attempt.id,
          value: attempt.submittedAt.toISOString(),
        }),
      );
      return {
        items: page.items.map(({ moduleRun, ...attempt }) => ({
          ...attempt,
          runSequence: moduleRun.sequence,
        })),
        nextCursor: page.nextCursor,
      };
    },
    async recordAttempt(input) {
      return runSerializableProgressTransaction(client, async (transaction) => {
        const publicationFilter = input.preview ? {} : { isPublished: true };
        const accessibleAssessment =
          await transaction.conceptAssessment.findFirst({
            where: {
              conceptId: input.conceptId,
              id: input.assessmentId,
              concept: {
                lesson: {
                  id: input.lessonId,
                  ...publicationFilter,
                  module: {
                    ...publicationFilter,
                    stage: {
                      ...publicationFilter,
                      program: {
                        id: input.programId,
                        ...learningOrPreviewProgramWhere(
                          input.userId,
                          input.preview,
                        ),
                      },
                    },
                  },
                },
              },
            },
            select: { id: true },
          });
        if (!accessibleAssessment) throw assessmentNotFound();

        const moduleRun = await ensureCurrentModuleRunForLesson(
          transaction,
          input.lessonId,
          input.userId,
          input.submittedAt,
        );
        const currentProgress = await transaction.conceptProgress.findUnique({
          where: {
            userId_conceptId: {
              conceptId: input.conceptId,
              userId: input.userId,
            },
          },
        });
        const bestScore = Math.max(
          currentProgress?.bestScore ?? 0,
          input.score,
        );
        const wasValidated =
          currentProgress?.status === ConceptProgressStatus.VALIDATED;
        const status =
          input.passed || wasValidated
            ? ConceptProgressStatus.VALIDATED
            : ConceptProgressStatus.NEEDS_REVIEW;
        const validatedAt = input.passed
          ? input.submittedAt
          : (currentProgress?.validatedAt ?? null);
        const [attempt, progress] = await Promise.all([
          transaction.conceptAssessmentAttempt.create({
            data: {
              answers: input.answers,
              assessmentId: input.assessmentId,
              moduleRunId: moduleRun.id,
              passed: input.passed,
              score: input.score,
              submittedAt: input.submittedAt,
              userId: input.userId,
            },
          }),
          transaction.conceptProgress.upsert({
            where: {
              userId_conceptId: {
                conceptId: input.conceptId,
                userId: input.userId,
              },
            },
            create: {
              bestScore,
              conceptId: input.conceptId,
              lastAttemptAt: input.submittedAt,
              status,
              userId: input.userId,
              validatedAt,
            },
            update: {
              bestScore,
              lastAttemptAt: input.submittedAt,
              status,
              validatedAt,
            },
          }),
        ]);

        if (input.passed) {
          await transaction.reviewItem.updateMany({
            where: {
              sourceId: input.assessmentId,
              sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
              userId: input.userId,
            },
            data: {
              completedAt: input.submittedAt,
              status: ReviewStatus.COMPLETED,
            },
          });
        } else {
          await transaction.reviewItem.upsert({
            where: {
              userId_sourceType_sourceId: {
                sourceId: input.assessmentId,
                sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
                userId: input.userId,
              },
            },
            create: {
              dueAt: input.dueAt,
              lessonId: input.lessonId,
              programId: input.programId,
              sourceId: input.assessmentId,
              sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
              status: ReviewStatus.PENDING,
              userId: input.userId,
            },
            update: {
              completedAt: null,
              dueAt: input.dueAt,
              status: ReviewStatus.PENDING,
            },
          });
        }

        const lessonProgress = await recalculateProgress(
          transaction,
          input.lessonId,
          input.userId,
          input.submittedAt,
          { requirePublished: !input.preview },
        );
        if (!lessonProgress) throw assessmentNotFound();
        return {
          attempt: { ...attempt, runSequence: moduleRun.sequence },
          progress,
        };
      });
    },
  };
}
