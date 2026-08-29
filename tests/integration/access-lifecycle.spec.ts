import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/prisma.js';
import {
  createPrismaAccessInvitationActivationService,
  type AccessInvitationDeliveryInput,
} from '../../src/server/api/_lib/access-invitation.js';
import {
  consumeEmailVerification,
  hashVerificationToken,
  prismaEmailVerificationRepository,
} from '../../src/server/api/_lib/email-verification.js';
import { createPrismaAccessRequestReviewService } from '../../src/server/api/admin/access-request-review-service.js';
import { createPrismaAccountAdministrationService } from '../../src/server/api/admin/account-administration-service.js';
import { getSessionUser, loginUser } from '../../src/server/api/_lib/auth.js';
import { hashPassword } from '../../src/server/api/_lib/password.js';
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from '../../src/server/api/_lib/session.js';

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

test('revue admin réelle atomique, idempotente et auditée', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();

  const reviewer = await prisma.user.create({
    data: {
      displayName: 'Access reviewer integration',
      email: `${uniqueValue('access-reviewer')}@example.test`,
      passwordHash: 'not-a-real-password-hash',
      role: 'ADMIN',
    },
  });
  const approvedRequest = await prisma.accessRequest.create({
    data: {
      emailNormalized: `${uniqueValue('approved-request')}@example.test`,
      emailVerifiedAt: new Date(),
      status: 'PENDING_APPROVAL',
    },
  });
  const rejectedRequest = await prisma.accessRequest.create({
    data: {
      emailNormalized: `${uniqueValue('rejected-request')}@example.test`,
      emailVerifiedAt: new Date(),
      status: 'PENDING_APPROVAL',
    },
  });
  const hiddenRequest = await prisma.accessRequest.create({
    data: {
      emailNormalized: `${uniqueValue('hidden-request')}@example.test`,
    },
  });
  let deliveredInvitation: AccessInvitationDeliveryInput | undefined;
  const service = createPrismaAccessRequestReviewService(prisma, {
    delivery: {
      async send(input) {
        deliveredInvitation = input;
      },
    },
    invitationTtlMilliseconds: 60_000,
  });

  try {
    const page = await service.list({
      page: 1,
      pageSize: 10,
      search: approvedRequest.emailNormalized,
      status: 'PENDING_APPROVAL',
    });
    expect(page.items.map((item) => item.id)).toEqual([approvedRequest.id]);
    expect(page.items.some((item) => item.id === hiddenRequest.id)).toBe(false);

    const concurrentApprovals = await Promise.all([
      service.approve(reviewer.id, approvedRequest.id, {
        expectedVersion: 1,
        role: 'CREATOR',
      }),
      service.approve(reviewer.id, approvedRequest.id, {
        expectedVersion: 1,
        role: 'CREATOR',
      }),
    ]);
    expect(
      concurrentApprovals.filter((result) => result.kind === 'APPLIED'),
    ).toHaveLength(1);
    expect(
      concurrentApprovals.every((result) =>
        ['APPLIED', 'CONFLICT', 'IDEMPOTENT'].includes(result.kind),
      ),
    ).toBe(true);
    await expect(
      service.approve(reviewer.id, approvedRequest.id, {
        expectedVersion: 1,
        role: 'CREATOR',
      }),
    ).resolves.toMatchObject({ kind: 'IDEMPOTENT' });

    expect(
      await prisma.accessInvitation.count({
        where: { accessRequestId: approvedRequest.id },
      }),
    ).toBe(1);
    expect(deliveredInvitation).toMatchObject({
      recipientEmail: approvedRequest.emailNormalized,
    });
    expect(
      await prisma.auditEvent.findMany({
        orderBy: { action: 'asc' },
        select: { action: true },
        where: { targetId: { in: [approvedRequest.id] } },
      }),
    ).toEqual(
      expect.arrayContaining([
        { action: 'ACCESS_REQUEST_APPROVE' },
        { action: 'ACCOUNT_ROLE_ASSIGN' },
      ]),
    );

    await expect(
      service.reject(reviewer.id, rejectedRequest.id, {
        expectedVersion: 1,
        reason: 'Demande hors périmètre.',
      }),
    ).resolves.toMatchObject({ kind: 'APPLIED' });
    await expect(
      service.reject(reviewer.id, rejectedRequest.id, {
        expectedVersion: 1,
        reason: 'Demande hors périmètre.',
      }),
    ).resolves.toMatchObject({ kind: 'IDEMPOTENT' });
    expect(
      await prisma.accessInvitation.count({
        where: { accessRequestId: rejectedRequest.id },
      }),
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: {
          action: 'ACCESS_REQUEST_REJECT',
          targetId: rejectedRequest.id,
        },
      }),
    ).toBe(1);

    if (!deliveredInvitation) {
      throw new Error('Expected the access invitation to be delivered.');
    }
    const activationService = createPrismaAccessInvitationActivationService(
      prisma,
      {
        createSessionToken: () => randomUUID(),
        hashPassword: async () => 'integration-only-password-hash',
      },
    );
    const activation = await activationService.activate({
      displayName: 'Invited learner',
      password: 'not-stored-by-the-test',
      token: deliveredInvitation.token,
    });
    expect(activation?.user).toMatchObject({
      email: approvedRequest.emailNormalized,
      role: 'CREATOR',
    });
    await expect(
      activationService.activate({
        displayName: 'Invited learner',
        password: 'not-stored-by-the-test',
        token: deliveredInvitation.token,
      }),
    ).resolves.toBeNull();
    expect(
      await prisma.session.count({
        where: { userId: activation?.user.id },
      }),
    ).toBe(1);
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { actorUserId: reviewer.id },
    });
    await prisma.accessRequest.deleteMany({
      where: {
        id: {
          in: [approvedRequest.id, rejectedRequest.id, hiddenRequest.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: approvedRequest.emailNormalized },
    });
    await prisma.user.delete({ where: { id: reviewer.id } });
  }
});

test('suspension réelle multi-session, conservation et réactivation', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();

  const reviewer = await prisma.user.create({
    data: {
      displayName: 'Account administrator integration',
      email: `${uniqueValue('account-admin')}@example.test`,
      passwordHash: await hashPassword('admin-integration-password'),
      role: 'ADMIN',
    },
  });
  const password = 'learner-integration-password';
  const learner = await prisma.user.create({
    data: {
      displayName: 'Suspended learner integration',
      email: `${uniqueValue('suspended-learner')}@example.test`,
      passwordHash: await hashPassword(password),
      role: 'USER',
    },
  });
  const rawSessionTokens = [randomUUID(), randomUUID()];
  await prisma.session.createMany({
    data: rawSessionTokens.map((token) => ({
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: hashSessionToken(token),
      userId: learner.id,
    })),
  });
  const note = await prisma.note.create({
    data: {
      markdown: 'Cette note doit survivre à la suspension.',
      title: 'Note conservée',
      userId: learner.id,
    },
  });
  const service = createPrismaAccountAdministrationService(prisma);

  try {
    const suspended = await service.suspend(reviewer.id, learner.id, {
      expectedStatus: 'ACTIVE',
      expectedUpdatedAt: learner.updatedAt,
    });
    expect(suspended).toMatchObject({
      account: { accountStatus: 'SUSPENDED' },
      kind: 'APPLIED',
    });
    expect(await prisma.session.count({ where: { userId: learner.id } })).toBe(
      0,
    );
    expect(await prisma.note.count({ where: { id: note.id } })).toBe(1);
    await expect(
      getSessionUser(
        new Request('https://learn-x.app/api/auth/session', {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${rawSessionTokens[0]}`,
          },
        }),
      ),
    ).resolves.toBeNull();
    await expect(
      loginUser({ email: learner.email, password }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    await expect(
      service.suspend(reviewer.id, learner.id, {
        expectedStatus: 'ACTIVE',
        expectedUpdatedAt: learner.updatedAt,
      }),
    ).resolves.toMatchObject({ kind: 'IDEMPOTENT' });
    expect(
      await prisma.auditEvent.count({
        where: {
          action: 'ACCOUNT_SUSPEND',
          actorUserId: reviewer.id,
          targetId: learner.id,
        },
      }),
    ).toBe(1);

    if (!('account' in suspended)) {
      throw new Error('Expected suspended account state.');
    }
    const reactivated = await service.reactivate(reviewer.id, learner.id, {
      expectedStatus: 'SUSPENDED',
      expectedUpdatedAt: suspended.account.updatedAt,
    });
    expect(reactivated).toMatchObject({
      account: { accountStatus: 'ACTIVE', suspendedAt: null },
      kind: 'APPLIED',
    });
    expect(await prisma.session.count({ where: { userId: learner.id } })).toBe(
      0,
    );
    await expect(
      loginUser({ email: learner.email, password }),
    ).resolves.toMatchObject({
      user: { id: learner.id },
    });
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { actorUserId: reviewer.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [learner.id, reviewer.id] } },
    });
  }
});
