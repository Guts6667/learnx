import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { buildPublicationPlan } from './publication-plan.js';
import {
  createPrismaPublicationRepository,
  type PublicationRepository,
  type PublicationTransactionRepository,
} from './publication-repository.js';
import {
  PublicationPlanBlockedError,
  PublicationPlanStaleError,
  type ApplyPublicationRequest,
  type PublicationRequest,
  type PublicationService,
} from './publication-types.js';

export {
  PublicationPlanBlockedError,
  PublicationPlanStaleError,
  type ApplyPublicationRequest,
  type PublicationRequest,
  type PublicationService,
} from './publication-types.js';

function buildPlan(
  resolved: NonNullable<
    Awaited<ReturnType<PublicationRepository['readTarget']>>
  >,
  request: PublicationRequest,
) {
  return buildPublicationPlan(
    resolved.target,
    request.action,
    request.mode,
    resolved.context,
  );
}

async function applyPublication(
  repository: PublicationTransactionRepository,
  ownerId: string,
  request: ApplyPublicationRequest,
) {
  const resolved = await repository.readTarget(
    ownerId,
    request.targetType,
    request.targetId,
  );
  if (!resolved) return null;
  const plan = buildPlan(resolved, request);
  const isAlreadyApplied =
    plan.changes.length === 0 && plan.blockers.length === 0;
  if (plan.planId !== request.planId && !isAlreadyApplied) {
    throw new PublicationPlanStaleError();
  }
  if (plan.blockers.length > 0) throw new PublicationPlanBlockedError();
  await repository.applyChanges(plan);
  const version =
    plan.changes.length > 0
      ? await repository.createPublishedVersion(resolved.programId, ownerId)
      : null;
  await repository.writeApplyAudit(ownerId, request, plan, version);
  return plan;
}

export function createPublicationService(
  repository: PublicationRepository,
): PublicationService {
  return {
    apply: (ownerId, request) =>
      repository.transaction((transaction) =>
        applyPublication(transaction, ownerId, request),
      ),
    async preview(ownerId, request) {
      const resolved = await repository.readTarget(
        ownerId,
        request.targetType,
        request.targetId,
      );
      return resolved ? buildPlan(resolved, request) : null;
    },
  };
}

export function createPrismaPublicationService(
  client: PrismaClient,
): PublicationService {
  return createPublicationService(createPrismaPublicationRepository(client));
}
