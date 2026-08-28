import {
  AuditAction,
  type Prisma,
  type PrismaClient,
  type Role,
} from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';
import type {
  AccessRequestReviewFilters,
  AccessRequestReviewPage,
  AccessRequestReviewResult,
} from './access-request-review-types.js';
import {
  listReviewRequests,
  reviewInclude,
  toReviewItem,
} from './access-request-review-query.js';

interface InvitationMaterial {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  tokenHash: string;
}

export interface AccessRequestReviewRepository {
  approve(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number; role: Role },
    invitation: InvitationMaterial,
  ): Promise<AccessRequestReviewResult>;
  invalidateInvitation(invitationId: string, invalidatedAt: Date): Promise<void>;
  list(filters: AccessRequestReviewFilters): Promise<AccessRequestReviewPage>;
  reject(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number; reason: string },
    reviewedAt: Date,
  ): Promise<AccessRequestReviewResult>;
  resend(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number },
    invitation: InvitationMaterial,
  ): Promise<AccessRequestReviewResult>;
}

async function writeApprovalAudit(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  invitationId: string,
  values: { assignedRole: Role; expectedVersion: number },
) {
  const entries = [
    [AuditAction.ACCESS_REQUEST_APPROVE, requestId, 'access_request'],
    [AuditAction.ACCESS_INVITATION_ISSUE, invitationId, 'access_invitation'],
    [AuditAction.ACCOUNT_ROLE_ASSIGN, requestId, 'access_request'],
  ] as const;
  for (const [action, targetId, targetType] of entries) {
    await writeAuditEvent(transaction, {
      action,
      actorUserId,
      idempotencyKey: createAuditIdempotencyKey(action, targetId, values),
      metadata: values,
      targetId,
      targetType,
    });
  }
}

async function approveRequest(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  input: { expectedVersion: number; role: Role },
  invitation: InvitationMaterial,
): Promise<AccessRequestReviewResult> {
  const existing = await transaction.accessRequest.findUnique({
    include: reviewInclude,
    where: { id: requestId },
  });
  if (!existing || existing.status === 'PENDING_EMAIL') {
    return { kind: 'NOT_FOUND' };
  }
  if (existing.status === 'APPROVED') {
    return existing.invitations[0]?.assignedRole === input.role
      ? { kind: 'IDEMPOTENT', request: toReviewItem(existing) }
      : { kind: 'CONFLICT' };
  }
  if (
    existing.status !== 'PENDING_APPROVAL' ||
    existing.version !== input.expectedVersion
  ) {
    return { kind: 'CONFLICT' };
  }
  return applyApproval(transaction, actorUserId, requestId, input, invitation);
}

async function applyApproval(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  input: { expectedVersion: number; role: Role },
  invitation: InvitationMaterial,
): Promise<AccessRequestReviewResult> {
  const transitioned = await transaction.accessRequest.updateMany({
    data: {
      reviewedAt: invitation.createdAt,
      reviewedByUserId: actorUserId,
      status: 'APPROVED',
      version: { increment: 1 },
    },
    where: {
      id: requestId,
      status: 'PENDING_APPROVAL',
      version: input.expectedVersion,
    },
  });
  if (transitioned.count !== 1) return { kind: 'CONFLICT' };
  await transaction.accessInvitation.create({
    data: {
      accessRequestId: requestId,
      assignedRole: input.role,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      id: invitation.id,
      invitedByUserId: actorUserId,
      tokenHash: invitation.tokenHash,
    },
  });
  const values = {
    assignedRole: input.role,
    expectedVersion: input.expectedVersion,
  };
  await writeApprovalAudit(
    transaction,
    actorUserId,
    requestId,
    invitation.id,
    values,
  );
  const updated = await transaction.accessRequest.findUniqueOrThrow({
    include: reviewInclude,
    where: { id: requestId },
  });
  return { kind: 'APPLIED', request: toReviewItem(updated) };
}

async function writeRejectionAudit(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  input: { expectedVersion: number; reason: string },
) {
  const metadata = { expectedVersion: input.expectedVersion };
  await writeAuditEvent(transaction, {
    action: AuditAction.ACCESS_REQUEST_REJECT,
    actorUserId,
    idempotencyKey: createAuditIdempotencyKey(
      AuditAction.ACCESS_REQUEST_REJECT,
      requestId,
      { ...metadata, reason: input.reason },
    ),
    metadata,
    targetId: requestId,
    targetType: 'access_request',
  });
}

async function rejectRequest(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  input: { expectedVersion: number; reason: string },
  reviewedAt: Date,
): Promise<AccessRequestReviewResult> {
  const existing = await transaction.accessRequest.findUnique({
    include: reviewInclude,
    where: { id: requestId },
  });
  if (!existing || existing.status === 'PENDING_EMAIL') {
    return { kind: 'NOT_FOUND' };
  }
  if (existing.status === 'REJECTED') {
    return existing.rejectionReason === input.reason
      ? { kind: 'IDEMPOTENT', request: toReviewItem(existing) }
      : { kind: 'CONFLICT' };
  }
  if (
    existing.status !== 'PENDING_APPROVAL' ||
    existing.version !== input.expectedVersion
  ) {
    return { kind: 'CONFLICT' };
  }
  const transitioned = await transaction.accessRequest.updateMany({
    data: {
      rejectionReason: input.reason,
      reviewedAt,
      reviewedByUserId: actorUserId,
      status: 'REJECTED',
      version: { increment: 1 },
    },
    where: {
      id: requestId,
      status: 'PENDING_APPROVAL',
      version: input.expectedVersion,
    },
  });
  if (transitioned.count !== 1) return { kind: 'CONFLICT' };
  await transaction.accessInvitation.updateMany({
    data: { invalidatedAt: reviewedAt },
    where: {
      accessRequestId: requestId,
      consumedAt: null,
      invalidatedAt: null,
    },
  });
  await writeRejectionAudit(transaction, actorUserId, requestId, input);
  const updated = await transaction.accessRequest.findUniqueOrThrow({
    include: reviewInclude,
    where: { id: requestId },
  });
  return { kind: 'APPLIED', request: toReviewItem(updated) };
}

async function replaceInvitation(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  assignedRole: Role,
  invitation: InvitationMaterial,
) {
  await transaction.accessInvitation.updateMany({
    data: { invalidatedAt: invitation.createdAt },
    where: {
      accessRequestId: requestId,
      consumedAt: null,
      invalidatedAt: null,
    },
  });
  await transaction.accessInvitation.create({
    data: {
      accessRequestId: requestId,
      assignedRole,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      id: invitation.id,
      invitedByUserId: actorUserId,
      tokenHash: invitation.tokenHash,
    },
  });
}

async function writeInvitationAudit(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  expectedVersion: number,
  assignedRole: Role,
  invitationId: string,
) {
  const metadata = { assignedRole, expectedVersion };
  await writeAuditEvent(transaction, {
    action: AuditAction.ACCESS_INVITATION_ISSUE,
    actorUserId,
    idempotencyKey: createAuditIdempotencyKey(
      AuditAction.ACCESS_INVITATION_ISSUE,
      invitationId,
      metadata,
    ),
    metadata,
    targetId: invitationId,
    targetType: 'access_invitation',
  });
}

async function resendInvitation(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  requestId: string,
  input: { expectedVersion: number },
  invitation: InvitationMaterial,
): Promise<AccessRequestReviewResult> {
  const existing = await transaction.accessRequest.findUnique({
    include: reviewInclude,
    where: { id: requestId },
  });
  const assignedRole = existing?.invitations[0]?.assignedRole;
  if (!existing || existing.status !== 'APPROVED' || !assignedRole) {
    return { kind: 'NOT_FOUND' };
  }
  if (existing.version !== input.expectedVersion) return { kind: 'CONFLICT' };
  const transitioned = await transaction.accessRequest.updateMany({
    data: { version: { increment: 1 } },
    where: {
      activatedUserId: null,
      id: requestId,
      status: 'APPROVED',
      version: input.expectedVersion,
    },
  });
  if (transitioned.count !== 1) return { kind: 'CONFLICT' };
  await replaceInvitation(
    transaction,
    actorUserId,
    requestId,
    assignedRole,
    invitation,
  );
  await writeInvitationAudit(
    transaction,
    actorUserId,
    input.expectedVersion,
    assignedRole,
    invitation.id,
  );
  const updated = await transaction.accessRequest.findUniqueOrThrow({
    include: reviewInclude,
    where: { id: requestId },
  });
  return { kind: 'APPLIED', request: toReviewItem(updated) };
}

class PrismaAccessRequestReviewRepository
  implements AccessRequestReviewRepository
{
  public constructor(private readonly client: PrismaClient) {}

  approve(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number; role: Role },
    invitation: InvitationMaterial,
  ) {
    return this.client.$transaction((transaction) =>
      approveRequest(transaction, actorUserId, requestId, input, invitation),
    );
  }

  async invalidateInvitation(invitationId: string, invalidatedAt: Date) {
    await this.client.accessInvitation.updateMany({
      data: { invalidatedAt },
      where: { consumedAt: null, id: invitationId, invalidatedAt: null },
    });
  }

  list(filters: AccessRequestReviewFilters) {
    return listReviewRequests(this.client, filters);
  }

  reject(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number; reason: string },
    reviewedAt: Date,
  ) {
    return this.client.$transaction((transaction) =>
      rejectRequest(transaction, actorUserId, requestId, input, reviewedAt),
    );
  }

  resend(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number },
    invitation: InvitationMaterial,
  ) {
    return this.client.$transaction((transaction) =>
      resendInvitation(transaction, actorUserId, requestId, input, invitation),
    );
  }
}

export function createPrismaAccessRequestReviewRepository(
  client: PrismaClient,
): AccessRequestReviewRepository {
  return new PrismaAccessRequestReviewRepository(client);
}
