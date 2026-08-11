import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { prisma } from '../../src/server/prisma.js';
import { CreditLedgerError } from '../../src/server/credits/credit-ledger.js';
import { PrismaCreditLedger } from '../../src/server/credits/prisma-credit-ledger.js';

function integrationEmail(label: string): string {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? randomUUID();
  return `${label}-${runId}-${randomUUID()}@example.test`.toLowerCase();
}

test('ledger réel atomique, reconstructible et immuable', async (_fixtures, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  const now = new Date('2026-08-12T12:00:00.000Z');
  const learner = await prisma.user.create({
    data: {
      displayName: 'Learner ledger integration',
      email: integrationEmail('credit-learner'),
      passwordHash: 'not-a-login-account',
    },
  });
  const admin = await prisma.user.create({
    data: {
      displayName: 'Admin ledger integration',
      email: integrationEmail('credit-admin'),
      passwordHash: 'not-a-login-account',
      role: 'ADMIN',
    },
  });
  const ledger = new PrismaCreditLedger(prisma, () => now);

  const freeGrant = await ledger.grant({
    amount: 100n,
    expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    idempotencyKey: 'integration-free-grant',
    provenance: 'FREE_ALLOCATION',
    reference: { id: 'cycle-2026-08', type: 'FREE_ALLOCATION_CYCLE' },
    userId: learner.id,
  });
  await ledger.grant({
    amount: 100n,
    idempotencyKey: 'integration-paid-grant',
    provenance: 'PURCHASED',
    reference: { id: 'payment-fixture-1', type: 'PAYMENT_FIXTURE' },
    userId: learner.id,
  });
  expect(await ledger.getBalance(learner.id)).toEqual({
    free: 100n,
    purchased: 100n,
    total: 200n,
  });

  const expiry = new Date('2026-08-12T12:15:00.000Z');
  const concurrent = await Promise.allSettled([
    ledger.reserve({
      amount: 120n,
      expiresAt: expiry,
      idempotencyKey: 'integration-reservation-a',
      reference: { id: 'correction-a', type: 'AI_CORRECTION' },
      userId: learner.id,
    }),
    ledger.reserve({
      amount: 120n,
      expiresAt: expiry,
      idempotencyKey: 'integration-reservation-b',
      reference: { id: 'correction-b', type: 'AI_CORRECTION' },
      userId: learner.id,
    }),
  ]);
  const fulfilled = concurrent.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ledger.reserve>>> =>
      result.status === 'fulfilled',
  );
  const rejected = concurrent.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toBeInstanceOf(CreditLedgerError);
  expect(rejected[0].reason).toMatchObject({
    code: 'INSUFFICIENT_CREDITS',
  });

  const reservation = fulfilled[0].value.reservation;
  expect(reservation).toBeDefined();
  if (!reservation) throw new Error('The winning reservation is missing.');
  const winningKey = reservation.id;
  const settled = await ledger.settle({
    amount: 80n,
    reservationId: winningKey,
    userId: learner.id,
  });
  expect(settled.balance).toEqual({ free: 20n, purchased: 100n, total: 120n });
  expect(
    await ledger.settle({
      amount: 80n,
      reservationId: winningKey,
      userId: learner.id,
    }),
  ).toMatchObject({ balance: settled.balance, reservation: settled.reservation });

  const originalEntry = await prisma.creditLedgerEntry.findFirstOrThrow({
    where: { lotId: freeGrant.lotId, type: 'GRANT' },
  });
  await ledger.adjust({
    actorUserId: admin.id,
    amount: 10n,
    compensatesEntryId: originalEntry.id,
    expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    idempotencyKey: 'integration-admin-adjustment',
    provenance: 'FREE_ALLOCATION',
    reason: 'Correction compensatoire du test intégration',
    userId: learner.id,
  });
  expect(await ledger.getBalance(learner.id)).toEqual({
    free: 30n,
    purchased: 100n,
    total: 130n,
  });
  expect(
    await prisma.auditEvent.count({
      where: { action: 'CREDIT_ADMIN_ADJUSTMENT', actorUserId: admin.id },
    }),
  ).toBe(1);

  await expect(
    prisma.$executeRaw`UPDATE "credit_ledger_entries" SET "amount" = 999 WHERE "id" = ${originalEntry.id}::uuid`,
  ).rejects.toThrow(/append-only/i);

  await prisma.creditAccount.update({
    where: { userId_currency: { currency: 'LEARNX_CREDIT', userId: learner.id } },
    data: { freeBalance: 0n, purchasedBalance: 0n },
  });
  expect(await ledger.rebuildProjection(learner.id)).toEqual({
    free: 30n,
    purchased: 100n,
    total: 130n,
  });
});
