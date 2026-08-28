import type {
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
import type {
  AccessRequestReviewFilters,
  AccessRequestReviewItem,
  AccessRequestReviewPage,
  ReviewableAccessRequestStatus,
} from './access-request-review-types.js';
import { reviewableAccessRequestStatuses } from './access-request-review-types.js';

export const reviewInclude = {
  invitations: {
    orderBy: { createdAt: 'desc' as const },
    select: { assignedRole: true, expiresAt: true },
    take: 1,
  },
} as const;

type ReviewRecord = Prisma.AccessRequestGetPayload<{
  include: typeof reviewInclude;
}>;

export function toReviewItem(request: ReviewRecord): AccessRequestReviewItem {
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
    locale: request.locale === 'en' ? 'en' : 'fr',
    rejectionReason: request.rejectionReason,
    reviewedAt: request.reviewedAt,
    status: request.status as ReviewableAccessRequestStatus,
    version: request.version,
  };
}

function reviewWhere(filters: AccessRequestReviewFilters) {
  return {
    emailVerifiedAt: { not: null },
    emailNormalized: filters.search
      ? { contains: filters.search, mode: 'insensitive' as const }
      : undefined,
    status: filters.status
      ? filters.status
      : { in: [...reviewableAccessRequestStatuses] },
  };
}

export async function listReviewRequests(
  client: PrismaClient,
  filters: AccessRequestReviewFilters,
): Promise<AccessRequestReviewPage> {
  const where = reviewWhere(filters);
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
}
