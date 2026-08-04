import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/prisma.js';

function uniqueValue(label: string): string {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? 'local';
  return `${label}-${runId}-${randomUUID()}`.toLowerCase();
}

test('contraintes réelles du cycle accès et compatibilité des comptes V2', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();

  const email = `${uniqueValue('access-cycle')}@example.test`;
  const reviewerEmail = `${uniqueValue('reviewer')}@example.test`;
  const reviewer = await prisma.user.create({
    data: {
      displayName: 'Reviewer integration',
      email: reviewerEmail,
      passwordHash: 'not-a-real-password-hash',
      role: 'ADMIN',
    },
  });

  try {
    expect(reviewer.accountStatus).toBe('ACTIVE');
    expect(reviewer.suspendedAt).toBeNull();

    await expect(
      prisma.user.update({
        where: { id: reviewer.id },
        data: { accountStatus: 'SUSPENDED' },
      }),
    ).rejects.toThrow();
    await prisma.user.update({
      where: { id: reviewer.id },
      data: { accountStatus: 'SUSPENDED', suspendedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: reviewer.id },
      data: { accountStatus: 'ACTIVE', suspendedAt: null },
    });

    const concurrentRequests = await Promise.allSettled([
      prisma.accessRequest.create({ data: { emailNormalized: email } }),
      prisma.accessRequest.create({ data: { emailNormalized: email } }),
    ]);
    expect(
      concurrentRequests.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      concurrentRequests.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    const requestResult = concurrentRequests.find(
      (result) => result.status === 'fulfilled',
    );
    if (!requestResult || requestResult.status !== 'fulfilled') {
      throw new Error('Expected one access request to be created.');
    }
    const request = requestResult.value;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);

    await expect(
      prisma.accessRequest.create({
        data: { emailNormalized: email.toUpperCase() },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.emailVerification.create({
        data: {
          accessRequestId: request.id,
          expiresAt: new Date(now.getTime() - 1),
          tokenHash: uniqueValue('expired-verification'),
        },
      }),
    ).rejects.toThrow();

    const verification = await prisma.emailVerification.create({
      data: {
        accessRequestId: request.id,
        expiresAt,
        tokenHash: uniqueValue('verification'),
      },
    });

    await expect(
      prisma.emailVerification.create({
        data: {
          accessRequestId: request.id,
          expiresAt,
          tokenHash: uniqueValue('second-verification'),
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.accessInvitation.create({
        data: {
          accessRequestId: request.id,
          expiresAt,
          invitedByUserId: reviewer.id,
          tokenHash: uniqueValue('premature-invitation'),
        },
      }),
    ).rejects.toThrow();

    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: now },
    });
    await expect(
      prisma.emailVerification.update({
        where: { id: verification.id },
        data: { invalidatedAt: now },
      }),
    ).rejects.toThrow();
    await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        emailVerifiedAt: now,
        status: 'PENDING_APPROVAL',
      },
    });

    await expect(
      prisma.accessRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED' },
      }),
    ).rejects.toThrow();

    await prisma.accessRequest.update({
      where: { id: request.id },
      data: {
        reviewedAt: now,
        reviewedByUserId: reviewer.id,
        status: 'APPROVED',
      },
    });

    await prisma.accessInvitation.create({
      data: {
        accessRequestId: request.id,
        expiresAt,
        invitedByUserId: reviewer.id,
        tokenHash: uniqueValue('invitation'),
      },
    });
    await expect(
      prisma.accessInvitation.create({
        data: {
          accessRequestId: request.id,
          expiresAt,
          invitedByUserId: reviewer.id,
          tokenHash: uniqueValue('second-invitation'),
        },
      }),
    ).rejects.toThrow();
  } finally {
    await prisma.accessRequest.deleteMany({
      where: {
        OR: [{ emailNormalized: email }, { reviewedByUserId: reviewer.id }],
      },
    });
    await prisma.user.deleteMany({ where: { id: reviewer.id } });
  }
});
