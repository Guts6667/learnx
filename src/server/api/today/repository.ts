import { ReviewStatus, type PrismaClient } from '../../../../generated/prisma/client.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import type { TodayRepository } from './types.js';

export function createPrismaTodayRepository(
  client: PrismaClient,
): TodayRepository {
  return {
    async listActivePrograms(userId) {
      return client.program.findMany({
        where: learningProgramWhere(userId),
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          progress: {
            where: { userId },
            take: 1,
            select: { lastViewedAt: true, percent: true },
          },
          slug: true,
          title: true,
        },
      });
    },
    async listFinalAssessments(userId) {
      return client.stageAssessment.findMany({
        where: {
          isRequired: true,
          stage: {
            isPublished: true,
            program: learningProgramWhere(userId),
          },
        },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          stage: {
            select: {
              id: true,
              modules: {
                where: { isPublished: true },
                select: {
                  lessons: {
                    where: { isPublished: true },
                    select: {
                      progress: {
                        where: { userId },
                        take: 1,
                        select: { status: true },
                      },
                    },
                  },
                },
              },
              position: true,
              program: {
                select: {
                  id: true,
                  position: true,
                  slug: true,
                  title: true,
                },
              },
              progress: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              slug: true,
              title: true,
            },
          },
          submissions: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
          title: true,
        },
      });
    },
    async listLessons(userId) {
      const lessons = await client.lesson.findMany({
        where: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: learningProgramWhere(userId),
            },
          },
        },
        orderBy: [
          { module: { stage: { program: { position: 'asc' } } } },
          { module: { stage: { position: 'asc' } } },
          { module: { position: 'asc' } },
          { position: 'asc' },
        ],
        select: {
          activityCompletionCarryovers: {
            where: { userId },
            select: { activityKey: true, kind: true, moduleRunId: true },
          },
          concepts: {
            where: { isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              assessments: {
                where: { isRequired: true },
                select: {
                  id: true,
                  questions: { take: 1, select: { id: true } },
                },
              },
              id: true,
              progress: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              title: true,
            },
          },
          estimatedMinutes: true,
          exercises: {
            where: { isCanonical: true, isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              key: true,
              submissions: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              title: true,
            },
          },
          id: true,
          module: {
            select: {
              id: true,
              position: true,
              slug: true,
              stage: {
                select: {
                  id: true,
                  position: true,
                  program: {
                    select: {
                      id: true,
                      position: true,
                      slug: true,
                      title: true,
                    },
                  },
                  progress: {
                    where: { userId },
                    take: 1,
                    select: { status: true },
                  },
                  slug: true,
                  title: true,
                },
              },
              title: true,
            },
          },
          position: true,
          progress: {
            where: { userId },
            take: 1,
            select: { lastViewedAt: true, status: true },
          },
          quizzes: {
            where: { isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              attempts: {
                where: { userId },
                orderBy: { submittedAt: 'desc' },
                select: { passed: true },
                take: 1,
              },
              id: true,
              title: true,
            },
          },
          lessonSequenceItems: {
            orderBy: { position: 'asc' },
            select: {
              conceptAssessmentId: true,
              exerciseId: true,
              position: true,
              quizId: true,
              taskId: true,
            },
          },
          slug: true,
          tasks: {
            where: { isCanonical: true, isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              completions: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              id: true,
              key: true,
              title: true,
            },
          },
          title: true,
        },
      });
      const moduleIds = [...new Set(lessons.map((lesson) => lesson.module.id))];
      const currentRuns =
        moduleIds.length === 0
          ? []
          : await client.moduleRun.findMany({
              where: { moduleId: { in: moduleIds }, userId },
              orderBy: [{ moduleId: 'asc' }, { sequence: 'desc' }],
              select: { id: true, moduleId: true },
            });
      const currentRunByModule = new Map<string, string>();
      for (const run of currentRuns) {
        if (!currentRunByModule.has(run.moduleId)) {
          currentRunByModule.set(run.moduleId, run.id);
        }
      }
      const currentRunIds = new Set(currentRunByModule.values());
      return lessons.map((lesson) => ({
        ...lesson,
        activityCompletionCarryovers:
          lesson.activityCompletionCarryovers.filter((carryover) =>
            currentRunIds.has(carryover.moduleRunId),
          ),
      }));
    },
    async listPendingReviews(userId) {
      return client.reviewItem.findMany({
        where: {
          status: ReviewStatus.PENDING,
          userId,
          program: learningProgramWhere(userId),
          lesson: {
            isPublished: true,
            module: {
              isPublished: true,
              stage: { isPublished: true },
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        select: {
          dueAt: true,
          id: true,
          lesson: {
            select: {
              estimatedMinutes: true,
              module: {
                select: {
                  stage: { select: { title: true } },
                  title: true,
                },
              },
              slug: true,
              title: true,
            },
          },
          program: { select: { id: true, slug: true, title: true } },
          sourceId: true,
        },
      });
    },
  };
}
