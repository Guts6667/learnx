import {
  AuditAction,
  Prisma,
  ProgramStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { writeAuditEvent } from '../_lib/audit.js';
import { createOrReusePublishedProgramVersion } from './program-version-service.js';
import type {
  PublicationPlan,
  PublicationTargetType,
} from './publication-plan.js';
import {
  readPublicationTarget,
  type ResolvedPublicationTarget,
} from './publication-query.js';
import type { ApplyPublicationRequest } from './publication-types.js';

export type { ResolvedPublicationTarget } from './publication-query.js';

export interface PublicationTransactionRepository {
  applyChanges(plan: PublicationPlan): Promise<void>;
  createPublishedVersion(
    programId: string,
    ownerId: string,
  ): Promise<{
    id: string;
    version: number;
  } | null>;
  readTarget(
    ownerId: string,
    targetType: PublicationTargetType,
    targetId: string,
  ): Promise<ResolvedPublicationTarget | null>;
  writeApplyAudit(
    ownerId: string,
    request: ApplyPublicationRequest,
    plan: PublicationPlan,
    publishedVersion: { id: string; version: number } | null,
  ): Promise<void>;
}

export interface PublicationRepository {
  readTarget(
    ownerId: string,
    targetType: PublicationTargetType,
    targetId: string,
  ): Promise<ResolvedPublicationTarget | null>;
  transaction<T>(
    operation: (repository: PublicationTransactionRepository) => Promise<T>,
  ): Promise<T>;
}

type PublicationClient = Prisma.TransactionClient;

async function applyChanges(client: PublicationClient, plan: PublicationPlan) {
  const changes = (type: 'LESSON' | 'MODULE' | 'STAGE') =>
    plan.changes.filter((change) => change.type === type).map(({ id }) => id);
  const lessonIds = changes('LESSON');
  const moduleIds = changes('MODULE');
  const stageIds = changes('STAGE');
  if (lessonIds.length > 0) {
    await client.lesson.updateMany({
      data: { isPublished: plan.action === 'PUBLISH' },
      where: { id: { in: lessonIds } },
    });
  }
  if (moduleIds.length > 0) {
    await client.module.updateMany({
      data: { isPublished: plan.action === 'PUBLISH' },
      where: { id: { in: moduleIds } },
    });
  }
  if (stageIds.length > 0) {
    await client.stage.updateMany({
      data: { isPublished: plan.action === 'PUBLISH' },
      where: { id: { in: stageIds } },
    });
  }
  await applyProgramChange(client, plan);
}

async function applyProgramChange(
  client: PublicationClient,
  plan: PublicationPlan,
) {
  const program = plan.changes.find(({ type }) => type === 'PROGRAM');
  if (!program) return;
  await client.program.update({
    data: {
      status:
        plan.action === 'PUBLISH' ? ProgramStatus.ACTIVE : ProgramStatus.DRAFT,
    },
    where: { id: program.id },
  });
}

async function writeApplyAudit(
  client: PublicationClient,
  ownerId: string,
  request: ApplyPublicationRequest,
  plan: PublicationPlan,
  version: { id: string; version: number } | null,
) {
  await writeAuditEvent(client, {
    action: AuditAction.PROGRAM_PUBLICATION_APPLY,
    actorUserId: ownerId,
    idempotencyKey: request.planId,
    metadata: {
      action: request.action,
      changeCount: plan.changes.length,
      mode: request.mode,
      targetType: request.targetType,
      ...(version
        ? { versionId: version.id, versionNumber: version.version }
        : {}),
    },
    targetId: request.targetId,
    targetType: request.targetType.toLowerCase(),
  });
}

function isRetryableTransactionError(error: unknown) {
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
        timeout: 15_000,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw new Error('Publication transaction retry limit reached.');
}

class PrismaPublicationRepository implements PublicationTransactionRepository {
  public constructor(private readonly client: PublicationClient) {}

  applyChanges(plan: PublicationPlan) {
    return applyChanges(this.client, plan);
  }

  createPublishedVersion(programId: string, ownerId: string) {
    return createOrReusePublishedProgramVersion(
      this.client,
      programId,
      ownerId,
    );
  }

  readTarget(
    ownerId: string,
    targetType: PublicationTargetType,
    targetId: string,
  ) {
    return readPublicationTarget(this.client, ownerId, targetType, targetId);
  }

  writeApplyAudit(
    ownerId: string,
    request: ApplyPublicationRequest,
    plan: PublicationPlan,
    version: { id: string; version: number } | null,
  ) {
    return writeApplyAudit(this.client, ownerId, request, plan, version);
  }
}

class PrismaPublicationRootRepository implements PublicationRepository {
  public constructor(private readonly client: PrismaClient) {}

  readTarget(
    ownerId: string,
    targetType: PublicationTargetType,
    targetId: string,
  ) {
    return readPublicationTarget(
      this.client as unknown as Prisma.TransactionClient,
      ownerId,
      targetType,
      targetId,
    );
  }

  transaction<T>(
    operation: (repository: PublicationTransactionRepository) => Promise<T>,
  ) {
    return runSerializableTransaction(this.client, (transaction) =>
      operation(new PrismaPublicationRepository(transaction)),
    );
  }
}

export function createPrismaPublicationRepository(
  client: PrismaClient,
): PublicationRepository {
  return new PrismaPublicationRootRepository(client);
}
