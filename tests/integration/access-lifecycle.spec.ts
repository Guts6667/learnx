import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/prisma.js';
import {
  consumeEmailVerification,
  hashVerificationToken,
  prismaEmailVerificationRepository,
} from '../../src/server/api/_lib/email-verification.js';

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

test('vérification e-mail réelle expirante et one-shot', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();

  const email = `${uniqueValue('email-verification')}@example.test`;
  const expiredEmail = `${uniqueValue('expired-email-verification')}@example.test`;
  const token = randomUUID();
  const expiredToken = randomUUID();
  const request = await prisma.accessRequest.create({
    data: { emailNormalized: email },
  });
  const expiredRequest = await prisma.accessRequest.create({
    data: { emailNormalized: expiredEmail },
  });
  const now = new Date();
  const consumeDependencies = {
    now: () => new Date(),
    repository: prismaEmailVerificationRepository,
  };

  try {
    await prisma.emailVerification.create({
      data: {
        accessRequestId: request.id,
        expiresAt: new Date(now.getTime() + 60_000),
        tokenHash: hashVerificationToken(token),
      },
    });
    await prisma.emailVerification.create({
      data: {
        accessRequestId: expiredRequest.id,
        createdAt: new Date(now.getTime() - 120_000),
        expiresAt: new Date(now.getTime() - 60_000),
        tokenHash: hashVerificationToken(expiredToken),
      },
    });

    await expect(
      consumeEmailVerification(expiredToken, consumeDependencies),
    ).resolves.toBe(false);

    const doubleClick = await Promise.all([
      consumeEmailVerification(token, consumeDependencies),
      consumeEmailVerification(token, consumeDependencies),
    ]);
    expect(doubleClick.sort()).toEqual([false, true]);

    const updatedRequest = await prisma.accessRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(updatedRequest.status).toBe('PENDING_APPROVAL');
    expect(updatedRequest.emailVerifiedAt).not.toBeNull();
    await expect(
      consumeEmailVerification(token, consumeDependencies),
    ).resolves.toBe(false);
  } finally {
    await prisma.accessRequest.deleteMany({
      where: { id: { in: [request.id, expiredRequest.id] } },
    });
  }
});
