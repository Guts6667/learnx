import { randomUUID } from 'node:crypto';

import type { PrismaClient, Role } from '../../../../generated/prisma/client.js';
import {
  createAccessInvitationToken,
  getAccessInvitationTtlMilliseconds,
  hashAccessInvitationToken,
  type AccessInvitationDelivery,
} from '../_lib/access-invitation.js';
import { normalizeLocale } from '../../../shared/locale.js';
import {
  createPrismaAccessRequestReviewRepository,
  type AccessRequestReviewRepository,
} from './access-request-review-repository.js';
import type {
  AccessRequestReviewFilters,
  AccessRequestReviewPage,
  AccessRequestReviewResult,
} from './access-request-review-types.js';

export {
  reviewableAccessRequestStatuses,
  type AccessRequestReviewFilters,
  type AccessRequestReviewItem,
  type AccessRequestReviewPage,
  type AccessRequestReviewResult,
  type ReviewableAccessRequestStatus,
} from './access-request-review-types.js';

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

interface ReviewServiceOptions {
  delivery?: AccessInvitationDelivery;
  invitationTtlMilliseconds: number;
}

function createInvitation(ttl: number) {
  const createdAt = new Date();
  const token = createAccessInvitationToken();
  return {
    createdAt,
    expiresAt: new Date(createdAt.getTime() + ttl),
    id: randomUUID(),
    token,
    tokenHash: hashAccessInvitationToken(token),
  };
}

async function deliverInvitation(
  repository: AccessRequestReviewRepository,
  delivery: AccessInvitationDelivery | undefined,
  result: AccessRequestReviewResult,
  invitation: ReturnType<typeof createInvitation>,
) {
  if (result.kind !== 'APPLIED' || !delivery) return;
  try {
    await delivery.send({
      expiresAt: invitation.expiresAt,
      invitationId: invitation.id,
      locale: normalizeLocale(result.request.locale),
      recipientEmail: result.request.emailNormalized,
      token: invitation.token,
    });
  } catch (error) {
    await repository.invalidateInvitation(invitation.id, new Date());
    throw error;
  }
}

export function createAccessRequestReviewService(
  repository: AccessRequestReviewRepository,
  options: ReviewServiceOptions,
): AccessRequestReviewService {
  return {
    async approve(actorUserId, requestId, input) {
      const invitation = createInvitation(options.invitationTtlMilliseconds);
      const result = await repository.approve(
        actorUserId,
        requestId,
        input,
        invitation,
      );
      await deliverInvitation(repository, options.delivery, result, invitation);
      return result;
    },
    list: (filters) => repository.list(filters),
    reject: (actorUserId, requestId, input) =>
      repository.reject(actorUserId, requestId, input, new Date()),
    async resend(actorUserId, requestId, input) {
      const invitation = createInvitation(options.invitationTtlMilliseconds);
      const result = await repository.resend(
        actorUserId,
        requestId,
        input,
        invitation,
      );
      await deliverInvitation(repository, options.delivery, result, invitation);
      return result;
    },
  };
}

export function createPrismaAccessRequestReviewService(
  client: PrismaClient,
  options: {
    delivery?: AccessInvitationDelivery;
    invitationTtlMilliseconds?: number;
  } = {},
): AccessRequestReviewService {
  return createAccessRequestReviewService(
    createPrismaAccessRequestReviewRepository(client),
    {
      delivery: options.delivery,
      invitationTtlMilliseconds:
        options.invitationTtlMilliseconds ??
        getAccessInvitationTtlMilliseconds(),
    },
  );
}
