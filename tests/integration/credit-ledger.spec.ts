import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { prisma } from '../../src/server/prisma.js';
import { CreditLedgerError } from '../../src/server/credits/credit-ledger.js';
import { PrismaCreditLedger } from '../../src/server/credits/prisma-credit-ledger.js';

function integrationEmail(label: string): string {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? randomUUID();
  return `${label}-${runId}-${randomUUID()}@example.test`.toLowerCase();
}

test('ledger réel atomique, reconstructible et immuable', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();
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
  const purchasedGrant = await ledger.grant({
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
  if (!freeGrant.lotId || !purchasedGrant.lotId) {
    throw new Error('Credit grants must create immutable lots.');
  }
  const priorityLotIds = [freeGrant.lotId, purchasedGrant.lotId];

  const expiry = new Date('2026-08-12T12:15:00.000Z');
  const concurrent = await Promise.allSettled([
    ledger.reserve({
      amount: 120n,
      expiresAt: expiry,
      idempotencyKey: 'integration-reservation-a',
      priorityLotIds,
      reference: { id: 'correction-a', type: 'AI_CORRECTION' },
      userId: learner.id,
    }),
    ledger.reserve({
      amount: 120n,
      expiresAt: expiry,
      idempotencyKey: 'integration-reservation-b',
      priorityLotIds,
      reference: { id: 'correction-b', type: 'AI_CORRECTION' },
      userId: learner.id,
    }),
  ]);
  const fulfilled = concurrent.filter(
    (
      result,
    ): result is PromiseFulfilledResult<
      Awaited<ReturnType<typeof ledger.reserve>>
    > => result.status === 'fulfilled',
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
  ).toMatchObject({
    balance: settled.balance,
    reservation: settled.reservation,
  });

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
    where: {
      userId_currency: { currency: 'LEARNX_CREDIT', userId: learner.id },
    },
    data: { freeBalance: 0n, purchasedBalance: 0n },
  });
  expect(await ledger.rebuildProjection(learner.id)).toEqual({
    free: 30n,
    purchased: 100n,
    total: 130n,
  });
});

test('un échec de finalisation annule toutes les écritures du règlement', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();
  const now = new Date('2026-08-12T13:00:00.000Z');
  const learner = await prisma.user.create({
    data: {
      displayName: 'Learner ledger rollback',
      email: integrationEmail('credit-rollback'),
      passwordHash: 'not-a-login-account',
    },
  });
  const ledger = new PrismaCreditLedger(prisma, () => now);
  const grant = await ledger.grant({
    amount: 100n,
    expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    idempotencyKey: 'integration-rollback-grant',
    provenance: 'FREE_ALLOCATION',
    reference: { id: 'rollback-cycle', type: 'FREE_ALLOCATION_CYCLE' },
    userId: learner.id,
  });
  if (!grant.lotId) throw new Error('The rollback grant lot is missing.');
  const reserved = await ledger.reserve({
    amount: 80n,
    expiresAt: new Date('2026-08-12T13:15:00.000Z'),
    idempotencyKey: 'integration-rollback-reservation',
    priorityLotIds: [grant.lotId],
    reference: { id: 'rollback-correction', type: 'AI_CORRECTION' },
    userId: learner.id,
  });
  const reservationId = reserved.reservation?.id;
  if (!reservationId) throw new Error('The rollback reservation is missing.');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION reject_credit_reservation_finalization()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id = '${reservationId}'::uuid THEN
        RAISE EXCEPTION 'forced finalization failure';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER reject_credit_reservation_finalization_trigger
    BEFORE UPDATE ON credit_reservations
    FOR EACH ROW EXECUTE FUNCTION reject_credit_reservation_finalization();
  `);
  try {
    await expect(
      ledger.settle({ amount: 60n, reservationId, userId: learner.id }),
    ).rejects.toThrow(/forced finalization failure/i);
    expect(
      await prisma.creditLedgerEntry.count({
        where: {
          reservationId,
          type: { in: ['RESERVATION_RELEASE', 'SETTLEMENT'] },
        },
      }),
    ).toBe(0);
    expect(
      await prisma.creditReservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true },
      }),
    ).toEqual({ status: 'RESERVED' });
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS reject_credit_reservation_finalization_trigger ON credit_reservations',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS reject_credit_reservation_finalization()',
    );
  }
  await ledger.release({ reservationId, userId: learner.id });
});
