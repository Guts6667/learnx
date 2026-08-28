import type { Role } from '../../../../generated/prisma/client.js';
import type { SupportedLocale } from '../../../shared/locale.js';

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
  locale?: SupportedLocale;
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
