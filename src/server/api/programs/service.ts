import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type { getStageValidation } from '../_lib/stage-validation.js';
import type {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import { createCurriculumRepository } from './repository.js';
import {
  getRecommendedExpandedStageId,
  isStageLocked,
  serializeLessonSummary,
  serializeStage,
} from './serialization.js';
import { curriculumNotFound, selectAccessibleCandidate } from './validation.js';
import type {
  readProgramViewPreference,
  saveProgramViewPreference,
} from './view-preference-repository.js';

interface CurriculumServiceOptions {
  client: PrismaClient;
  readProgramTimeline: typeof getProgramTimeline;
  readProgramViewPreference: typeof readProgramViewPreference;
  readStageTimeline: typeof getStageTimeline;
  readStageValidation: typeof getStageValidation;
  saveProgramViewPreference: typeof saveProgramViewPreference;
}

type CurriculumRepository = ReturnType<typeof createCurriculumRepository>;

async function listPrograms(
  options: CurriculumServiceOptions,
  repository: CurriculumRepository,
  userId: string,
  preview: boolean,
) {
  const programs = await repository.listPrograms(userId, preview);
  return Promise.all(
    programs.map(async (program) => ({
      ...program,
      timeline: await options.readProgramTimeline(
        options.client,
        program.id,
        userId,
      ),
    })),
  );
}

async function readProgram(
  options: CurriculumServiceOptions,
  repository: CurriculumRepository,
  programSlug: string,
  userId: string,
  preview: boolean,
) {
  const programs = await repository.findProgramsBySlug(
    programSlug,
    userId,
    preview,
  );
  const program = selectAccessibleCandidate(
    programs,
    userId,
    (candidate) => candidate.ownerId,
  );
  const [timeline, stages, storedExpandedStageId] = await Promise.all([
    options.readProgramTimeline(options.client, program.id, userId),
    Promise.all(
      program.stages.map(async (stage) => ({
        ...serializeStage(stage),
        timeline: await options.readStageTimeline(
          options.client,
          stage.id,
          userId,
        ),
      })),
    ),
    options.readProgramViewPreference(options.client, userId, program.id),
  ]);
  const visibleStageIds = new Set(stages.map(({ id }) => id));
  const expandedStageId =
    storedExpandedStageId && visibleStageIds.has(storedExpandedStageId)
      ? storedExpandedStageId
      : getRecommendedExpandedStageId(stages);
  return {
    ...program,
    stages,
    timeline,
    viewPreference: { expandedStageId },
  };
}

async function saveViewPreference(
  options: CurriculumServiceOptions,
  repository: CurriculumRepository,
  programSlug: string,
  userId: string,
  expandedStageId: string,
  preview: boolean,
) {
  const programs = await repository.findProgramStageIds(
    programSlug,
    userId,
    preview,
  );
  const program = selectAccessibleCandidate(
    programs,
    userId,
    (candidate) => candidate.ownerId,
  );
  if (!program.stages.some(({ id }) => id === expandedStageId)) {
    throw curriculumNotFound();
  }
  await options.saveProgramViewPreference(
    options.client,
    userId,
    program.id,
    expandedStageId,
  );
  return { expandedStageId };
}

async function readStage(
  options: CurriculumServiceOptions,
  repository: CurriculumRepository,
  programSlug: string,
  stageSlug: string,
  userId: string,
  preview: boolean,
) {
  const stages = await repository.findStages(
    programSlug,
    stageSlug,
    userId,
    preview,
  );
  const stage = selectAccessibleCandidate(
    stages,
    userId,
    (candidate) => candidate.program.ownerId,
  );
  const [timeline, validation] = await Promise.all([
    options.readStageTimeline(options.client, stage.id, userId),
    options.readStageValidation(options.client, stage.id, userId, { preview }),
  ]);
  const { program: _programAccess, ...stageWithAccess } = stage;
  void _programAccess;
  return { ...serializeStage(stageWithAccess), timeline, validation };
}

async function readModule(
  repository: CurriculumRepository,
  moduleSlug: string,
  userId: string,
  preview: boolean,
) {
  const modules = await repository.findModules(moduleSlug, userId, preview);
  const selectedModule = selectAccessibleCandidate(
    modules,
    userId,
    (candidate) => candidate.stage.program.ownerId,
  );
  const moduleIsLocked = isStageLocked(selectedModule.stage);
  const { progress, program, ...stageWithoutProgram } = selectedModule.stage;
  const { ownerId: _ownerId, ...programContext } = program;
  void _ownerId;
  void progress;
  return {
    ...selectedModule,
    lessons: selectedModule.lessons.map((lesson) =>
      serializeLessonSummary(lesson, moduleIsLocked),
    ),
    stage: { ...stageWithoutProgram, program: programContext },
  };
}

async function readLesson(
  repository: CurriculumRepository,
  lessonSlug: string,
  userId: string,
  preview: boolean,
) {
  const lessons = await repository.findLessons(lessonSlug, userId, preview);
  const lesson = selectAccessibleCandidate(
    lessons,
    userId,
    (candidate) => candidate.module.stage.program.ownerId,
  );
  const currentLessonIndex = lesson.module.lessons.findIndex(
    (candidate) => candidate.id === lesson.id,
  );
  const previousLesson = lesson.module.lessons[currentLessonIndex - 1] ?? null;
  const nextLesson = lesson.module.lessons[currentLessonIndex + 1] ?? null;
  const lessonIsLocked = isStageLocked(lesson.module.stage);
  const { progress, program, ...stageWithoutProgram } = lesson.module.stage;
  const { ownerId: _ownerId, ...programContext } = program;
  const { lessons: siblingLessons, ...moduleWithoutLessons } = lesson.module;
  void siblingLessons;
  void _ownerId;
  void progress;
  return {
    ...lesson,
    sequence: lesson.lessonSequenceItems,
    isLocked: lessonIsLocked,
    module: {
      ...moduleWithoutLessons,
      stage: { ...stageWithoutProgram, program: programContext },
    },
    navigation: {
      nextLesson: nextLesson
        ? { ...nextLesson, isLocked: lessonIsLocked }
        : null,
      previousLesson: previousLesson
        ? { ...previousLesson, isLocked: lessonIsLocked }
        : null,
    },
    quizzes: lesson.quizzes.map(({ _count, ...quiz }) => ({
      ...quiz,
      questionCount: _count.questions,
    })),
    tasks: lesson.tasks.map(({ resources, ...task }) => ({
      ...task,
      resources: resources.map((link) => link.resource),
    })),
    lessonSequenceItems: undefined,
  };
}

export function createCurriculumService(options: CurriculumServiceOptions) {
  const repository = createCurriculumRepository(options.client);
  return {
    listPrograms: (userId: string, preview: boolean) =>
      listPrograms(options, repository, userId, preview),
    readLesson: (lessonSlug: string, userId: string, preview: boolean) =>
      readLesson(repository, lessonSlug, userId, preview),
    readModule: (moduleSlug: string, userId: string, preview: boolean) =>
      readModule(repository, moduleSlug, userId, preview),
    readProgram: (programSlug: string, userId: string, preview: boolean) =>
      readProgram(options, repository, programSlug, userId, preview),
    readStage: (
      programSlug: string,
      stageSlug: string,
      userId: string,
      preview: boolean,
    ) =>
      readStage(options, repository, programSlug, stageSlug, userId, preview),
    saveViewPreference: (
      programSlug: string,
      userId: string,
      expandedStageId: string,
      preview: boolean,
    ) =>
      saveViewPreference(
        options,
        repository,
        programSlug,
        userId,
        expandedStageId,
        preview,
      ),
  };
}
