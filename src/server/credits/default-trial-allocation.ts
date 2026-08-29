import { PrismaCorrectionBreaker } from '../corrections/correction-breaker.js';
import { ownerAlert } from '../corrections/owner-alert.js';
import { PrismaCreditLedger } from './prisma-credit-ledger.js';
import { createPrismaTrialAllocation } from './prisma-trial-allocation.js';

/**
 * The runtime wiring of the trial allocation (V4.5-163C).
 *
 * Separate from the service so the service stays testable without a database,
 * and so there is exactly one place that answers "what calls this in
 * production" — the question that went unasked when 163 shipped a mechanism
 * nothing invoked.
 */
export async function createDefaultTrialAllocation(input?: {
  clientAddress?: string | null;
}) {
  const { prisma } = await import('../prisma.js');
  const ledger = new PrismaCreditLedger(prisma);
  const breaker = new PrismaCorrectionBreaker(prisma, ownerAlert());
  return createPrismaTrialAllocation(prisma, {
    async breakerIsOpen() {
      return (await breaker.status()).state === 'OPEN';
    },
    ...(input?.clientAddress === undefined
      ? {}
      : { clientAddress: input.clientAddress }),
    async grant(grantInput) {
      const result = await ledger.grant({
        amount: grantInput.amount,
        idempotencyKey: grantInput.idempotencyKey,
        provenance: 'FREE_ALLOCATION',
        reference: grantInput.reference,
        userId: grantInput.userId,
      });
      if (!result.lotId) throw new Error('TRIAL_GRANT_MISSING_LOT');
      return { lotId: result.lotId };
    },
    now: () => new Date(),
  });
}
