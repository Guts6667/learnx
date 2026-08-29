import type { PrismaClient } from '../../../generated/prisma/client.js';
import { hashBucketKey } from '../api/_lib/bucket-key.js';
import {
  evaluateTrialAbuse,
  type TrialAbuseLimits,
} from './trial-abuse-limit.js';
import {
  monthlyCycleKey,
  policyForCohort,
  type TrialGrantOutcome,
} from './trial-allocation.js';

/**
 * Issues the scheduled free allocation (V4.5-163).
 *
 * Where the no-double-grant guarantee actually comes from, since this is the
 * money path and the answer must not be "the code checks first":
 *
 * `grantCredits` is idempotent on its operation key — it looks for an existing
 * ledger entry under `grant:<key>` inside the account lock and returns the
 * original lot instead of creating a second one. The key here is derived from
 * the policy, the cycle and the user, so two concurrent calls for the same
 * cycle produce one lot whichever wins the lock. `credit_grant_cycles` then
 * records which cycle that lot belonged to, and its own uniqueness on
 * (userId, policyVersionId, cycleKey) refuses a second record.
 *
 * The early check below is a fast path, not the guarantee. Removing it would
 * cost a redundant call and change no outcome.
 */

export interface TrialAllocationDeps {
  /**
   * The caller's address, or null where none is available. Null means the
   * anti-abuse rules cannot apply, which is allowed: refusing every grant we
   * cannot attribute would punish learners for a proxy's behaviour.
   */
  clientAddress?: string | null;
  limits?: TrialAbuseLimits;
  /** Open ⇒ no grant this cycle. A product rule, confirmed, not a fallback. */
  breakerIsOpen(): Promise<boolean>;
  grant(input: {
    amount: bigint;
    idempotencyKey: string;
    reference: { id: string; type: string };
    userId: string;
  }): Promise<{ lotId: string }>;
  now(): Date;
}

export function createPrismaTrialAllocation(
  client: PrismaClient,
  deps: TrialAllocationDeps,
) {
  return {
    async grantForCycle(userId: string): Promise<TrialGrantOutcome> {
      const cycleKey = monthlyCycleKey(deps.now());
      const user = await client.user.findUnique({
        select: { cohort: true },
        where: { id: userId },
      });
      if (!user) return { cycleKey, kind: 'NO_POLICY' };

      const candidates = await client.creditAllocationPolicyVersion.findMany({
        select: { allocationAmount: true, cohort: true, id: true },
        where: { provenance: 'FREE_ALLOCATION', status: 'ACTIVE' },
      });
      const policy = policyForCohort(
        candidates.flatMap((candidate) =>
          candidate.allocationAmount === null
            ? []
            : [
                {
                  allocationAmount: candidate.allocationAmount,
                  cohort: candidate.cohort,
                  id: candidate.id,
                },
              ],
        ),
        user.cohort,
      );
      if (!policy) return { cycleKey, kind: 'NO_POLICY' };

      const existing = await client.creditGrantCycle.findUnique({
        select: { id: true },
        where: {
          userId_policyVersionId_cycleKey: {
            cycleKey,
            policyVersionId: policy.id,
            userId,
          },
        },
      });
      if (existing) return { cycleKey, kind: 'ALREADY_GRANTED' };

      // Checked before granting rather than after: a suspended feature must not
      // be paid for with credits the learner cannot spend this cycle.
      if (await deps.breakerIsOpen()) return { cycleKey, kind: 'SUSPENDED' };

      const markerKey = deps.clientAddress
        ? hashBucketKey(`trial-allocation:ip:${deps.clientAddress}`)
        : null;
      if (markerKey) {
        const marker = await client.trialAllocationMarker.findUnique({
          where: { keyHash: markerKey },
        });
        const verdict = evaluateTrialAbuse({
          ...(deps.limits ? { limits: deps.limits } : {}),
          marker,
          now: deps.now(),
        });
        if (verdict !== 'ALLOWED')
          return { cycleKey, kind: 'REFUSED', verdict };
      }

      const idempotencyKey = `trial:${policy.id}:${cycleKey}:${userId}`;
      const { lotId } = await deps.grant({
        amount: policy.allocationAmount,
        idempotencyKey,
        reference: { id: policy.id, type: 'TRIAL_ALLOCATION' },
        userId,
      });

      const account = await client.creditAccount.findFirstOrThrow({
        select: { id: true },
        where: { userId },
      });
      await client.creditGrantCycle.upsert({
        create: {
          accountId: account.id,
          // Stamped, not joined: correcting a learner's cohort later must not
          // rewrite what was granted to them under the old one.
          cohort: user.cohort,
          cycleKey,
          idempotencyKey,
          lotId,
          policyVersionId: policy.id,
          userId,
        },
        update: {},
        where: { userId_idempotencyKey: { idempotencyKey, userId } },
      });
      if (markerKey) {
        // Counted after the grant succeeds, so a refusal upstream never
        // consumes an allowance the learner did not receive.
        await client.trialAllocationMarker.upsert({
          create: { grants: 1, keyHash: markerKey, lastSeenAt: deps.now() },
          update: { grants: { increment: 1 }, lastSeenAt: deps.now() },
          where: { keyHash: markerKey },
        });
      }
      return { amount: policy.allocationAmount, cycleKey, kind: 'GRANTED' };
    },
  };
}
