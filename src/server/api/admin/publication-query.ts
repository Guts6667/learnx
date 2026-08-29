import {
  Prisma,
  TranslationWorkflowStatus,
} from '../../../../generated/prisma/client.js';
import { editorialProgramWhere } from '../_lib/program-access-policy.js';
import type {
  PublicationTarget,
  PublicationTargetType,
} from './publication-plan.js';

const lessonSelect = {
  concepts: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: {
      assessments: {
        orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
        select: { id: true },
        where: { isRequired: true },
      },
      id: true,
      title: true,
    },
    where: { isRequired: true },
  },
  id: true,
  isPublished: true,
  title: true,
  updatedAt: true,
} satisfies Prisma.LessonSelect;

const policySelect = {
  id: true,
  locale: true,
  title: true,
  translationWorkflow: {
    select: {
      sourceProgramVersionId: true,
      status: true,
      updatedAt: true,
      version: true,
    },
  },
} satisfies Prisma.ProgramSelect;

const moduleSelect = {
  id: true,
  isPublished: true,
  lessons: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: lessonSelect,
  },
  title: true,
  updatedAt: true,
  stage: {
    select: { program: { select: policySelect }, programId: true },
  },
} satisfies Prisma.ModuleSelect;

const stageSelect = {
  assessments: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true },
    where: { isRequired: true },
  },
  id: true,
  isPublished: true,
  modules: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: moduleSelect,
  },
  title: true,
  updatedAt: true,
  programId: true,
  program: { select: policySelect },
} satisfies Prisma.StageSelect;

const programSelect = {
  id: true,
  stages: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: stageSelect,
  },
  status: true,
  title: true,
  locale: true,
  translationWorkflow: policySelect.translationWorkflow,
  updatedAt: true,
} satisfies Prisma.ProgramSelect;

type LessonRecord = Prisma.LessonGetPayload<{ select: typeof lessonSelect }>;
type ModuleRecord = Prisma.ModuleGetPayload<{ select: typeof moduleSelect }>;
type StageRecord = Prisma.StageGetPayload<{ select: typeof stageSelect }>;
type ProgramRecord = Prisma.ProgramGetPayload<{ select: typeof programSelect }>;
type TranslationPolicy = Prisma.ProgramGetPayload<{
  select: typeof policySelect;
}>;

function mapLesson(lesson: LessonRecord) {
  return {
    id: lesson.id,
    isPublished: lesson.isPublished,
    requiredConcepts: lesson.concepts.map((concept) => ({
      assessmentIds: concept.assessments.map(({ id }) => id),
      id: concept.id,
      title: concept.title,
    })),
    title: lesson.title,
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

function mapModule(module: ModuleRecord) {
  return {
    id: module.id,
    isPublished: module.isPublished,
    lessons: module.lessons.map(mapLesson),
    title: module.title,
    updatedAt: module.updatedAt.toISOString(),
  };
}

function mapStage(stage: StageRecord) {
  return {
    finalAssessmentIds: stage.assessments.map(({ id }) => id),
    id: stage.id,
    isPublished: stage.isPublished,
    modules: stage.modules.map(mapModule),
    title: stage.title,
    updatedAt: stage.updatedAt.toISOString(),
  };
}

function mapProgram(program: ProgramRecord) {
  return {
    id: program.id,
    stages: program.stages.map(mapStage),
    status: program.status,
    title: program.title,
    updatedAt: program.updatedAt.toISOString(),
  };
}

function publicationContext(policy: TranslationPolicy) {
  const workflow = policy.translationWorkflow;
  const approved = workflow?.status === TranslationWorkflowStatus.APPROVED;
  return {
    blockers:
      policy.locale !== 'fr' && !approved
        ? [
            {
              code: 'TRANSLATION_REVIEW_REQUIRED' as const,
              id: policy.id,
              message:
                'La variante linguistique doit terminer ses revues humaines et sa QA avant publication.',
              title: policy.title,
              type: 'PROGRAM' as const,
            },
          ]
        : [],
    version: JSON.stringify({
      locale: policy.locale,
      sourceProgramVersionId: workflow?.sourceProgramVersionId ?? null,
      status: workflow?.status ?? null,
      updatedAt: workflow?.updatedAt.toISOString() ?? null,
      version: workflow?.version ?? 0,
    }),
  };
}

export interface ResolvedPublicationTarget {
  context: ReturnType<typeof publicationContext>;
  programId: string;
  target: PublicationTarget;
}

async function readModuleTarget(
  client: Prisma.TransactionClient,
  ownerId: string,
  targetId: string,
): Promise<ResolvedPublicationTarget | null> {
  const module = await client.module.findFirst({
    select: moduleSelect,
    where: { id: targetId, stage: { program: editorialProgramWhere(ownerId) } },
  });
  return module
    ? {
        context: publicationContext(module.stage.program),
        programId: module.stage.programId,
        target: { entity: mapModule(module), type: 'MODULE' },
      }
    : null;
}

export async function readPublicationTarget(
  client: Prisma.TransactionClient,
  ownerId: string,
  targetType: PublicationTargetType,
  targetId: string,
): Promise<ResolvedPublicationTarget | null> {
  if (targetType === 'PROGRAM') {
    const program = await client.program.findFirst({
      select: programSelect,
      where: { id: targetId, ...editorialProgramWhere(ownerId) },
    });
    return program
      ? {
          context: publicationContext(program),
          programId: program.id,
          target: { entity: mapProgram(program), type: 'PROGRAM' },
        }
      : null;
  }
  if (targetType === 'STAGE') {
    const stage = await client.stage.findFirst({
      select: stageSelect,
      where: { id: targetId, program: editorialProgramWhere(ownerId) },
    });
    return stage
      ? {
          context: publicationContext(stage.program),
          programId: stage.programId,
          target: { entity: mapStage(stage), type: 'STAGE' },
        }
      : null;
  }
  return readModuleTarget(client, ownerId, targetId);
}
