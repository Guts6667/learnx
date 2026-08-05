import { randomUUID } from 'node:crypto';

import {
  AuditAction,
  type PrismaClient,
  Role,
} from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';
import {
  createAccessInvitationToken,
  getAccessInvitationTtlMilliseconds,
  hashAccessInvitationToken,
  type AccessInvitationDelivery,
} from '../_lib/access-invitation.js';

export const reviewableAccessRequestStatuses = [
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
] as const;

export type ReviewableAccessRequestStatus =
  (typeof reviewableAccessRequestStatuses)[number];

export interface AccessRequestReviewItem {
  assignedRole: Role | null;
  createdAt: Date;
  emailNormalized: string;
  emailVerifiedAt: Date;
  id: string;
  invitationExpiresAt: Date | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  status: ReviewableAccessRequestStatus;
  version: number;
}

export interface AccessRequestReviewPage {
  items: AccessRequestReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AccessRequestReviewFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: ReviewableAccessRequestStatus;
}

export type AccessRequestReviewResult =
  | { kind: 'APPLIED' | 'IDEMPOTENT'; request: AccessRequestReviewItem }
  | { kind: 'CONFLICT' }
  | { kind: 'NOT_FOUND' };

export interface AccessRequestReviewService {
  approve(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number; role: Role },
  ): Promise<AccessRequestReviewResult>;
  list(filters: AccessRequestReviewFilters): Promise<AccessRequestReviewPage>;
  reject(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number; reason: string },
  ): Promise<AccessRequestReviewResult>;
  resend(
    actorUserId: string,
    requestId: string,
    input: { expectedVersion: number },
  ): Promise<AccessRequestReviewResult>;
}

const reviewInclude = {
  invitations: {
    orderBy: { createdAt: 'desc' as const },
    select: { assignedRole: true, expiresAt: true },
    take: 1,
  },
} as const;

function toReviewItem(request: {
  createdAt: Date;
  emailNormalized: string;
  emailVerifiedAt: Date | null;
  id: string;
  invitations: Array<{ assignedRole: Role; expiresAt: Date }>;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  status: string;
  version: number;
}): AccessRequestReviewItem {
  if (
    !request.emailVerifiedAt ||
    !reviewableAccessRequestStatuses.includes(
      request.status as ReviewableAccessRequestStatus,
    )
  ) {
    throw new Error('Access request is not reviewable.');
  }
  const invitation = request.invitations[0];

  return {
    assignedRole: invitation?.assignedRole ?? null,
    createdAt: request.createdAt,
    emailNormalized: request.emailNormalized,
    emailVerifiedAt: request.emailVerifiedAt,
    id: request.id,
    invitationExpiresAt: invitation?.expiresAt ?? null,
    rejectionReason: request.rejectionReason,
    reviewedAt: request.reviewedAt,
    status: request.status as ReviewableAccessRequestStatus,
    version: request.version,
  };
}

export function createPrismaAccessRequestReviewService(
  client: PrismaClient,
  options: {
    delivery?: AccessInvitationDelivery;
    invitationTtlMilliseconds?: number;
  } = {},
): AccessRequestReviewService {
  const invitationTtlMilliseconds =
    options.invitationTtlMilliseconds ??
    getAccessInvitationTtlMilliseconds();

  async function deliverOrInvalidate(input: {
    expiresAt: Date;
    invitationId: string;
    recipientEmail: string;
    token: string;
  }): Promise<void> {
    if (!options.delivery) return;
    try {
      await options.delivery.send(input);
    } catch (error) {
      await client.accessInvitation.updateMany({
        data: { invalidatedAt: new Date() },
        where: {
          consumedAt: null,
          id: input.invitationId,
          invalidatedAt: null,
        },
      });
      throw error;
    }
  }

  return {
    async list(filters) {
      const where = {
        emailVerifiedAt: { not: null },
        emailNormalized: filters.search
          ? { contains: filters.search, mode: 'insensitive' as const }
          : undefined,
        status: filters.status
          ? filters.status
          : { in: [...reviewableAccessRequestStatuses] },
      };
      const [total, requests] = await client.$transaction([
        client.accessRequest.count({ where }),
        client.accessRequest.findMany({
          include: reviewInclude,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
          where,
        }),
      ]);

      return {
        items: requests.map(toReviewItem),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      };
    },

    async approve(actorUserId, requestId, input) {
      const now = new Date();
      const invitationId = randomUUID();
      const invitationExpiresAt = new Date(
        now.getTime() + invitationTtlMilliseconds,
      );
      const invitationToken = createAccessInvitationToken();
      const invitationTokenHash =
        hashAccessInvitationToken(invitationToken);

      const result = await client.$transaction(async (transaction) => {
        const existing = await transaction.accessRequest.findUnique({
          include: reviewInclude,
          where: { id: requestId },
        });
        if (!existing || existing.status === 'PENDING_EMAIL') {
          return { kind: 'NOT_FOUND' } as const;
        }
        if (existing.status === 'APPROVED') {
          return existing.invitations[0]?.assignedRole === input.role
            ? { kind: 'IDEMPOTENT' as const, request: toReviewItem(existing) }
            : { kind: 'CONFLICT' as const };
        }
        if (
          existing.status !== 'PENDING_APPROVAL' ||
          existing.version !== input.expectedVersion
        ) {
          return { kind: 'CONFLICT' } as const;
        }

        const transitioned = await transaction.accessRequest.updateMany({
          data: {
            reviewedAt: now,
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
        if (transitioned.count !== 1) {
          return { kind: 'CONFLICT' } as const;
        }

        await transaction.accessInvitation.create({
          data: {
            accessRequestId: requestId,
            assignedRole: input.role,
            createdAt: now,
            expiresAt: invitationExpiresAt,
            id: invitationId,
            invitedByUserId: actorUserId,
            tokenHash: invitationTokenHash,
          },
        });

        const auditValues = {
          assignedRole: input.role,
          expectedVersion: input.expectedVersion,
        };
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCESS_REQUEST_APPROVE,
          actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCESS_REQUEST_APPROVE,
            requestId,
            auditValues,
          ),
          metadata: auditValues,
          targetId: requestId,
          targetType: 'access_request',
        });
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCESS_INVITATION_ISSUE,
          actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCESS_INVITATION_ISSUE,
            invitationId,
            auditValues,
          ),
          metadata: auditValues,
          targetId: invitationId,
          targetType: 'access_invitation',
        });
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCOUNT_ROLE_ASSIGN,
          actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCOUNT_ROLE_ASSIGN,
            requestId,
            auditValues,
          ),
          metadata: auditValues,
          targetId: requestId,
          targetType: 'access_request',
        });

        const updated = await transaction.accessRequest.findUniqueOrThrow({
          include: reviewInclude,
          where: { id: requestId },
        });
        return { kind: 'APPLIED' as const, request: toReviewItem(updated) };
      });
      if (result.kind === 'APPLIED') {
        await deliverOrInvalidate({
          expiresAt: invitationExpiresAt,
          invitationId,
          recipientEmail: result.request.emailNormalized,
          token: invitationToken,
        });
      }
      return result;
    },

    async reject(actorUserId, requestId, input) {
      const now = new Date();

      return client.$transaction(async (transaction) => {
        const existing = await transaction.accessRequest.findUnique({
          include: reviewInclude,
          where: { id: requestId },
        });
        if (!existing || existing.status === 'PENDING_EMAIL') {
          return { kind: 'NOT_FOUND' } as const;
        }
        if (existing.status === 'REJECTED') {
          return existing.rejectionReason === input.reason
            ? { kind: 'IDEMPOTENT' as const, request: toReviewItem(existing) }
            : { kind: 'CONFLICT' as const };
        }
        if (
          existing.status !== 'PENDING_APPROVAL' ||
          existing.version !== input.expectedVersion
        ) {
          return { kind: 'CONFLICT' } as const;
        }

        const transitioned = await transaction.accessRequest.updateMany({
          data: {
            rejectionReason: input.reason,
            reviewedAt: now,
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
        if (transitioned.count !== 1) {
          return { kind: 'CONFLICT' } as const;
        }

        await transaction.accessInvitation.updateMany({
          data: { invalidatedAt: now },
          where: {
            accessRequestId: requestId,
            consumedAt: null,
            invalidatedAt: null,
          },
        });
        const auditValues = { expectedVersion: input.expectedVersion };
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCESS_REQUEST_REJECT,
          actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCESS_REQUEST_REJECT,
            requestId,
            { ...auditValues, reason: input.reason },
          ),
          metadata: auditValues,
          targetId: requestId,
          targetType: 'access_request',
        });

        const updated = await transaction.accessRequest.findUniqueOrThrow({
          include: reviewInclude,
          where: { id: requestId },
        });
        return { kind: 'APPLIED' as const, request: toReviewItem(updated) };
      });
    },

    async resend(actorUserId, requestId, input) {
      const now = new Date();
      const invitationId = randomUUID();
      const invitationToken = createAccessInvitationToken();
      const invitationExpiresAt = new Date(
        now.getTime() + invitationTtlMilliseconds,
      );

      const result = await client.$transaction(async (transaction) => {
        const existing = await transaction.accessRequest.findUnique({
          include: reviewInclude,
          where: { id: requestId },
        });
        const assignedRole = existing?.invitations[0]?.assignedRole;
        if (!existing || existing.status !== 'APPROVED' || !assignedRole) {
          return { kind: 'NOT_FOUND' } as const;
        }
        if (existing.version !== input.expectedVersion) {
          return { kind: 'CONFLICT' } as const;
        }
        const transitioned = await transaction.accessRequest.updateMany({
          data: { version: { increment: 1 } },
          where: {
            activatedUserId: null,
            id: requestId,
            status: 'APPROVED',
            version: input.expectedVersion,
          },
        });
        if (transitioned.count !== 1) {
          return { kind: 'CONFLICT' } as const;
        }
        await transaction.accessInvitation.updateMany({
          data: { invalidatedAt: now },
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
            createdAt: now,
            expiresAt: invitationExpiresAt,
            id: invitationId,
            invitedByUserId: actorUserId,
            tokenHash: hashAccessInvitationToken(invitationToken),
          },
        });
        const auditValues = {
          assignedRole,
          expectedVersion: input.expectedVersion,
        };
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCESS_INVITATION_ISSUE,
          actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCESS_INVITATION_ISSUE,
            invitationId,
            auditValues,
          ),
          metadata: auditValues,
          targetId: invitationId,
          targetType: 'access_invitation',
        });
        const updated = await transaction.accessRequest.findUniqueOrThrow({
          include: reviewInclude,
          where: { id: requestId },
        });
        return { kind: 'APPLIED' as const, request: toReviewItem(updated) };
      });

      if (result.kind === 'APPLIED') {
        await deliverOrInvalidate({
          expiresAt: invitationExpiresAt,
          invitationId,
          recipientEmail: result.request.emailNormalized,
          token: invitationToken,
        });
      }
      return result;
    },
  };
}
