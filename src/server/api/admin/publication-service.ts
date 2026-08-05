import {
  AuditAction,
  Prisma,
  ProgramStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  buildPublicationPlan,
  type PublicationAction,
  type PublicationMode,
  type PublicationPlan,
  type PublicationTarget,
  type PublicationTargetType,
} from './publication-plan.js';
import { writeAuditEvent } from '../_lib/audit.js';
import { editorialProgramWhere } from '../_lib/program-access-policy.js';
import { createOrReusePublishedProgramVersion } from './program-version-service.js';

export interface PublicationRequest {
  action: PublicationAction;
  mode: PublicationMode;
  targetId: string;
  targetType: PublicationTargetType;
}

export interface ApplyPublicationRequest extends PublicationRequest {
  planId: string;
}

export interface PublicationService {
  apply(
    ownerId: string,
    request: ApplyPublicationRequest,
  ): Promise<PublicationPlan | null>;
  preview(
    ownerId: string,
    request: PublicationRequest,
  ): Promise<PublicationPlan | null>;
}

export class PublicationPlanBlockedError extends Error {
  public constructor() {
    super('Publication requirements are not satisfied.');
    this.name = 'PublicationPlanBlockedError';
  }
}

export class PublicationPlanStaleError extends Error {
  public constructor() {
    super('The publication preview is no longer current.');
    this.name = 'PublicationPlanStaleError';
  }
}

const lessonPublicationSelect = {
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

const modulePublicationSelect = {
  id: true,
  isPublished: true,
  lessons: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: lessonPublicationSelect,
  },
  title: true,
  updatedAt: true,
  stage: { select: { programId: true } },
} satisfies Prisma.ModuleSelect;

const stagePublicationSelect = {
  assessments: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true },
    where: { isRequired: true },
  },
  id: true,
  isPublished: true,
  modules: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: modulePublicationSelect,
  },
  title: true,
  updatedAt: true,
  programId: true,
} satisfies Prisma.StageSelect;

const programPublicationSelect = {
  id: true,
  stages: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    select: stagePublicationSelect,
  },
  status: true,
  title: true,
  updatedAt: true,
} satisfies Prisma.ProgramSelect;

type LessonRecord = Prisma.LessonGetPayload<{
  select: typeof lessonPublicationSelect;
}>;
type ModuleRecord = Prisma.ModuleGetPayload<{
  select: typeof modulePublicationSelect;
}>;
type StageRecord = Prisma.StageGetPayload<{
  select: typeof stagePublicationSelect;
}>;
type ProgramRecord = Prisma.ProgramGetPayload<{
  select: typeof programPublicationSelect;
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

async function readTarget(
  client: Prisma.TransactionClient,
  ownerId: string,
  targetType: PublicationTargetType,
  targetId: string,
): Promise<{ programId: string; target: PublicationTarget } | null> {
  if (targetType === 'PROGRAM') {
    const program = await client.program.findFirst({
      select: programPublicationSelect,
      where: { id: targetId, ...editorialProgramWhere(ownerId) },
    });
    return program
      ? {
          programId: program.id,
          target: { entity: mapProgram(program), type: 'PROGRAM' },
        }
      : null;
  }

  if (targetType === 'STAGE') {
    const stage = await client.stage.findFirst({
      select: stagePublicationSelect,
      where: { id: targetId, program: editorialProgramWhere(ownerId) },
    });
    return stage
      ? {
          programId: stage.programId,
          target: { entity: mapStage(stage), type: 'STAGE' },
        }
      : null;
  }

  const module = await client.module.findFirst({
    select: modulePublicationSelect,
    where: {
      id: targetId,
      stage: { program: editorialProgramWhere(ownerId) },
    },
  });
  return module
    ? {
        programId: module.stage.programId,
        target: { entity: mapModule(module), type: 'MODULE' },
      }
    : null;
}

async function applyChanges(
  transaction: Prisma.TransactionClient,
  plan: PublicationPlan,
): Promise<void> {
  const lessonChanges = plan.changes.filter(({ type }) => type === 'LESSON');
  const moduleChanges = plan.changes.filter(({ type }) => type === 'MODULE');
  const stageChanges = plan.changes.filter(({ type }) => type === 'STAGE');
  const programChange = plan.changes.find(({ type }) => type === 'PROGRAM');

  if (lessonChanges.length > 0) {
    await transaction.lesson.updateMany({
      data: { isPublished: plan.action === 'PUBLISH' },
      where: { id: { in: lessonChanges.map(({ id }) => id) } },
    });
  }
  if (moduleChanges.length > 0) {
    await transaction.module.updateMany({
      data: { isPublished: plan.action === 'PUBLISH' },
      where: { id: { in: moduleChanges.map(({ id }) => id) } },
    });
  }
  if (stageChanges.length > 0) {
    await transaction.stage.updateMany({
      data: { isPublished: plan.action === 'PUBLISH' },
      where: { id: { in: stageChanges.map(({ id }) => id) } },
    });
  }
  if (programChange) {
    await transaction.program.update({
      data: {
        status:
          plan.action === 'PUBLISH'
            ? ProgramStatus.ACTIVE
            : ProgramStatus.DRAFT,
      },
      where: { id: programChange.id },
    });
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

async function runSerializableTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 3) throw error;
    }
  }

  throw new Error('Publication transaction retry limit reached.');
}

export function createPrismaPublicationService(
  client: PrismaClient,
): PublicationService {
  return {
    async apply(ownerId, request) {
      return runSerializableTransaction(client, async (transaction) => {
        const resolved = await readTarget(
          transaction,
          ownerId,
          request.targetType,
          request.targetId,
        );
        if (!resolved) return null;

        const plan = buildPublicationPlan(
          resolved.target,
          request.action,
          request.mode,
        );
        const isAlreadyApplied =
          plan.changes.length === 0 && plan.blockers.length === 0;

        if (plan.planId !== request.planId && !isAlreadyApplied) {
          throw new PublicationPlanStaleError();
        }
        if (plan.blockers.length > 0) {
          throw new PublicationPlanBlockedError();
        }

        await applyChanges(transaction, plan);
        const publishedVersion =
          plan.changes.length > 0
            ? await createOrReusePublishedProgramVersion(
                transaction,
                resolved.programId,
                ownerId,
              )
            : null;
        await writeAuditEvent(transaction, {
          action: AuditAction.PROGRAM_PUBLICATION_APPLY,
          actorUserId: ownerId,
          idempotencyKey: request.planId,
          metadata: {
            action: request.action,
            changeCount: plan.changes.length,
            mode: request.mode,
            targetType: request.targetType,
            ...(publishedVersion
              ? {
                  versionId: publishedVersion.id,
                  versionNumber: publishedVersion.version,
                }
              : {}),
          },
          targetId: request.targetId,
          targetType: request.targetType.toLowerCase(),
        });
        return plan;
      });
    },
    async preview(ownerId, request) {
      const resolved = await readTarget(
        client as unknown as Prisma.TransactionClient,
        ownerId,
        request.targetType,
        request.targetId,
      );

      return resolved
        ? buildPublicationPlan(resolved.target, request.action, request.mode)
        : null;
    },
  };
}
