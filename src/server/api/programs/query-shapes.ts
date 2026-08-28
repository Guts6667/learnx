import { getPublicationFilter } from './validation.js';
import {
  getModuleInclude,
  getStageInclude,
  lessonSummarySelect,
} from './serialization.js';

export function getProgramListInclude(preview: boolean) {
  return {
    stages: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      select: {
        id: true,
        isPublished: true,
        position: true,
        slug: true,
        title: true,
      },
    },
  } as const;
}

export function getProgramDetailInclude(preview: boolean, userId: string) {
  return {
    stages: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      include: getStageInclude(preview, userId),
    },
  } as const;
}

export function getProgramStageIdsInclude(preview: boolean) {
  return {
    stages: {
      where: getPublicationFilter(preview),
      select: { id: true },
    },
  } as const;
}

function getModuleStageSelect(userId: string) {
  return {
    id: true,
    isPublished: true,
    slug: true,
    title: true,
    program: {
      select: { id: true, ownerId: true, slug: true, title: true },
    },
    progress: {
      where: { userId },
      take: 1,
      select: { status: true },
    },
  } as const;
}

export function getModuleDetailInclude(preview: boolean, userId: string) {
  return {
    ...getModuleInclude(preview, userId),
    stage: { select: getModuleStageSelect(userId) },
  } as const;
}

function getLessonConceptsSelect() {
  return {
    assessments: {
      orderBy: { position: 'asc' as const },
      select: {
        id: true,
        key: true,
        isRequired: true,
        position: true,
        questionCount: true,
        title: true,
      },
    },
    id: true,
    isRequired: true,
    masteryThreshold: true,
    position: true,
    slug: true,
    title: true,
  } as const;
}

function getLessonExercisesSelect() {
  return {
    id: true,
    instructions: true,
    isRequired: true,
    key: true,
    position: true,
    rubric: true,
    title: true,
  } as const;
}

function getLessonQuizzesSelect() {
  return {
    _count: { select: { questions: true } },
    description: true,
    id: true,
    isRequired: true,
    key: true,
    passingScore: true,
    position: true,
    title: true,
  } as const;
}

function getLessonTasksInclude() {
  return {
    resources: {
      orderBy: { resource: { position: 'asc' as const } },
      include: { resource: true },
    },
  } as const;
}

function getLessonModuleSelect(preview: boolean, userId: string) {
  return {
    id: true,
    isPublished: true,
    lessons: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      select: lessonSummarySelect,
    },
    slug: true,
    title: true,
    stage: { select: getModuleStageSelect(userId) },
  } as const;
}

export function getLessonDetailInclude(preview: boolean, userId: string) {
  return {
    concepts: {
      orderBy: { position: 'asc' as const },
      select: getLessonConceptsSelect(),
    },
    contentBlocks: { orderBy: { position: 'asc' as const } },
    exercises: {
      where: { isCanonical: true },
      orderBy: { position: 'asc' as const },
      select: getLessonExercisesSelect(),
    },
    quizzes: {
      orderBy: { position: 'asc' as const },
      select: getLessonQuizzesSelect(),
    },
    resources: { orderBy: { position: 'asc' as const } },
    lessonSequenceItems: {
      orderBy: { position: 'asc' as const },
      select: { id: true, key: true, kind: true },
    },
    tasks: {
      where: { isCanonical: true },
      orderBy: { position: 'asc' as const },
      include: getLessonTasksInclude(),
    },
    module: { select: getLessonModuleSelect(preview, userId) },
  } as const;
}
