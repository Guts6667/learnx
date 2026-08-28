import {
  LessonProgressStatus,
  StageProgressStatus,
} from '../../../../generated/prisma/client.js';
import { calculateModuleProgress } from '../../../lib/module-progress.js';
import { getPublicationFilter } from './validation.js';

export const lessonSummarySelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  objectives: true,
  prerequisites: true,
  estimatedMinutes: true,
  isPublished: true,
  position: true,
} as const;

function getLessonSummarySelect(userId: string) {
  return {
    ...lessonSummarySelect,
    _count: {
      select: {
        concepts: true,
        exercises: { where: { isCanonical: true } },
        quizzes: true,
        resources: true,
        tasks: { where: { isCanonical: true } },
      },
    },
    progress: {
      where: { userId },
      take: 1,
      select: { percent: true, status: true },
    },
  } as const;
}

export function getModuleInclude(preview: boolean, userId: string) {
  return {
    lessons: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      select: getLessonSummarySelect(userId),
    },
  };
}

export function getStageInclude(preview: boolean, userId: string) {
  return {
    modules: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      include: getModuleInclude(preview, userId),
    },
    progress: {
      where: { userId },
      take: 1,
      select: { percent: true, status: true },
    },
  };
}

interface LessonSummaryRecord {
  _count: {
    concepts: number;
    exercises: number;
    quizzes: number;
    resources: number;
    tasks: number;
  };
  progress: Array<{ percent: number; status: LessonProgressStatus }>;
}

export function serializeLessonSummary<T extends LessonSummaryRecord>(
  lesson: T,
  isLocked = false,
) {
  const { _count, progress, ...summary } = lesson;
  return {
    ...summary,
    activityCounts: _count,
    isLocked,
    progress: progress[0] ?? {
      percent: 0,
      status: LessonProgressStatus.AVAILABLE,
    },
  };
}

function serializeModules<
  T extends { lessons: LessonSummaryRecord[] },
>(modules: T[], isLocked = false) {
  return modules.map((module) => {
    const lessons = module.lessons.map((lesson) =>
      serializeLessonSummary(lesson, isLocked),
    );
    return {
      ...module,
      lessons,
      progress: calculateModuleProgress(
        lessons.map((lesson) => lesson.progress),
        isLocked,
      ),
    };
  });
}

export function isStageLocked(stage: {
  progress?: Array<{ status: string }>;
}): boolean {
  return stage.progress?.[0]?.status === StageProgressStatus.LOCKED;
}

export function serializeStage<
  T extends {
    modules: Array<{ lessons: LessonSummaryRecord[] }>;
    progress: Array<{ percent: number; status: StageProgressStatus }>;
  },
>(stage: T) {
  const { progress, ...summary } = stage;
  const stageProgress = progress[0] ?? {
    percent: 0,
    status: StageProgressStatus.AVAILABLE,
  };
  return {
    ...summary,
    modules: serializeModules(stage.modules, isStageLocked(stage)),
    progress: stageProgress,
  };
}

export function getRecommendedExpandedStageId(
  stages: Array<{
    id: string;
    progress: { status: StageProgressStatus };
  }>,
): string | null {
  if (stages.length === 0) return null;
  const activeStage = stages.find(
    ({ progress }) =>
      progress.status !== StageProgressStatus.COMPLETED &&
      progress.status !== StageProgressStatus.LOCKED,
  );
  if (activeStage) return activeStage.id;
  const lastCompletedStage = [...stages]
    .reverse()
    .find(({ progress }) => progress.status === StageProgressStatus.COMPLETED);
  return lastCompletedStage?.id ?? stages[0].id;
}
