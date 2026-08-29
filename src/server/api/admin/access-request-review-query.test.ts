import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import {
  listReviewRequests,
  toReviewItem,
} from './access-request-review-query.js';

const verifiedAt = new Date('2026-08-28T12:00:00.000Z');

function record(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: verifiedAt,
    emailNormalized: 'learner@example.com',
    emailVerifiedAt: verifiedAt,
    id: 'request-1',
    invitations: [],
    locale: 'fr',
    rejectionReason: null,
    reviewedAt: null,
    status: 'PENDING_APPROVAL',
    version: 1,
    ...overrides,
  };
}

describe('access request review query', () => {
  it.each([
    record({ emailVerifiedAt: null }),
    record({ status: 'PENDING_EMAIL' }),
  ])('rejects records that are not reviewable', (value) => {
    expect(() => toReviewItem(value as never)).toThrow(
      'Access request is not reviewable.',
    );
  });

  it('normalizes locale and optional invitation details', () => {
    expect(toReviewItem(record({ locale: 'en' }) as never)).toMatchObject({
      assignedRole: null,
      invitationExpiresAt: null,
      locale: 'en',
    });
    expect(
      toReviewItem(
        record({
          invitations: [{ assignedRole: 'USER', expiresAt: verifiedAt }],
          locale: 'de',
        }) as never,
      ),
    ).toMatchObject({
      assignedRole: 'USER',
      invitationExpiresAt: verifiedAt,
      locale: 'fr',
    });
  });

  it.each([
    {
      filters: {
        page: 2,
        pageSize: 2,
        search: 'learn',
        status: 'APPROVED' as const,
      },
      total: 3,
      totalPages: 2,
    },
    {
      filters: { page: 1, pageSize: 10 },
      total: 0,
      totalPages: 1,
    },
  ])(
    'lists reviewable records with filters and pagination',
    async ({ filters, total, totalPages }) => {
      const count = vi.fn().mockResolvedValue(total);
      const findMany = vi
        .fn()
        .mockResolvedValue(total ? [record({ status: 'APPROVED' })] : []);
      const client = {
        $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
          Promise.all(operations),
        ),
        accessRequest: { count, findMany },
      };

      await expect(
        listReviewRequests(client as unknown as PrismaClient, filters),
      ).resolves.toMatchObject({
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages,
      });
      expect(count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          emailNormalized:
            'search' in filters
              ? { contains: filters.search, mode: 'insensitive' }
              : undefined,
          status:
            'status' in filters
              ? filters.status
              : { in: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] },
        }),
      });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
        }),
      );
    },
  );
});
