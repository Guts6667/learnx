import {
  ReviewStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import {
  getFinalAssessmentSelect,
  getTodayLessonSelect,
} from './query-shapes.js';
import type { TodayRepository } from './types.js';

function filterCarryoversForCurrentRuns<
  T extends {
    activityCompletionCarryovers: Array<{ moduleRunId: string }>;
  },
>(lessons: T[], currentRunIds: Set<string>) {
  return lessons.map((lesson) => ({
    ...lesson,
    activityCompletionCarryovers: lesson.activityCompletionCarryovers.filter(
      (carryover) => currentRunIds.has(carryover.moduleRunId),
    ),
  }));
}

class PrismaTodayRepository implements TodayRepository {
  constructor(private readonly client: PrismaClient) {}

  listActivePrograms(userId: string) {
    return this.client.program.findMany({
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
  }

  listFinalAssessments(userId: string) {
    return this.client.stageAssessment.findMany({
      where: {
        isRequired: true,
        stage: {
          isPublished: true,
          program: learningProgramWhere(userId),
        },
      },
      orderBy: { position: 'asc' },
      select: getFinalAssessmentSelect(userId),
    });
  }

  async listLessons(userId: string) {
    const lessons = await this.client.lesson.findMany({
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
      select: getTodayLessonSelect(userId),
    });
    const moduleIds = [...new Set(lessons.map(({ module }) => module.id))];
    const currentRuns =
      moduleIds.length === 0
        ? []
        : await this.client.moduleRun.findMany({
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
    return filterCarryoversForCurrentRuns(
      lessons,
      new Set(currentRunByModule.values()),
    );
  }

  listPendingReviews(userId: string) {
    return this.client.reviewItem.findMany({
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
  }
}

export function createPrismaTodayRepository(
  client: PrismaClient,
): TodayRepository {
  return new PrismaTodayRepository(client);
}
