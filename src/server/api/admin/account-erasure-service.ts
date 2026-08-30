import { SYSTEM_ACTOR_ID } from '../../system-actor.js';
import {
  AccountStatus,
  AuditAction,
  Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';

/**
 * Right to erasure by pseudonymisation (RGPD art. 17, audit §4 E1).
 *
 * Pseudonymisation and not anonymisation, deliberately and in every name here.
 * The account row survives because the credit ledger references it and the
 * ledger is never rewritten (ADR_003 §6), so what is destroyed is the direct
 * identity — e-mail, display name, credentials, sessions — while structured
 * rows keep pointing at a user that no longer names anyone.
 *
 * That is enough to make the *structured* record non-identifying. It is not
 * enough for free text the learner wrote, which can name them however clean the
 * account row is — which is why the word here is pseudonymisation and not
 * anonymisation, everywhere, including in what we tell the learner.
 *
 * The owner decided on 29 August 2026 (`owner-erasure-2026-08-29`) to retain
 * that text under the pseudonym: exercise and assessment answers, the
 * correction snapshots, the evidence quotes and the raw model output all
 * survive. Private notes do not — they serve neither accounting nor research,
 * so they are the one kind of learner text with no reason to outlive the
 * account. Each erasure records the policy it ran under, so a later change of
 * policy does not make the older records ambiguous.
 */

export type AccountErasureResult =
  | { kind: 'ERASED' }
  | { kind: 'ALREADY_ERASED' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'CONFLICT' };

/**
 * The retention policy this service implements, stamped on every erasure so a
 * record made under one policy is never read as though it were made under a
 * later one.
 */
const LEARNER_TEXT_POLICY = 'RETAINED_UNDER_PSEUDONYM' as const;

/** A pseudonym derived from the account id: stable, unique, and meaningless. */
function pseudonym(userId: string): { displayName: string; email: string } {
  return {
    displayName: 'Compte supprimé',
    // The id is already in the row; reusing it introduces nothing new and
    // keeps the unique index satisfied without a second identifier to store.
    email: `deleted+${userId}@accounts.invalid`,
  };
}

export function createAccountErasureService(client: PrismaClient) {
  return {
    async erase(input: {
      actorUserId: string;
      expectedUpdatedAt: Date;
      userId: string;
    }): Promise<AccountErasureResult> {
      return client.$transaction(async (transaction) => {
        const existing = await transaction.user.findUnique({
          select: { accountStatus: true, id: true, updatedAt: true },
          where: { id: input.userId },
        });
        if (!existing) return { kind: 'NOT_FOUND' } as const;
        // The technical account is not a person and has no right to erasure to
        // exercise. Pseudonymising it would break the audit trail of every
        // refund it ever recorded, for nobody's benefit (V4.5-203).
        if (input.userId === SYSTEM_ACTOR_ID) {
          return { kind: 'NOT_FOUND' } as const;
        }
        // Irreversible, so repeating it is a no-op rather than a second
        // erasure that would overwrite the first audit trail.
        if (existing.accountStatus === AccountStatus.PSEUDONYMISED) {
          return { kind: 'ALREADY_ERASED' } as const;
        }

        const now = new Date();
        const update = await transaction.user.updateMany({
          data: {
            accountStatus: AccountStatus.PSEUDONYMISED,
            // Credentials are replaced by a value no password hashes to, so
            // the account cannot be logged into even if the e-mail were known.
            passwordHash: `erased:${now.toISOString()}`,
            suspendedAt: now,
            ...pseudonym(input.userId),
          },
          where: {
            id: input.userId,
            updatedAt: input.expectedUpdatedAt,
          },
        });
        if (update.count !== 1) return { kind: 'CONFLICT' } as const;

        await transaction.session.deleteMany({
          where: { userId: input.userId },
        });
        // Private notes serve neither accounting nor research. They are the one
        // kind of learner text with no reason to survive under any reading.
        await transaction.note.deleteMany({ where: { userId: input.userId } });

        // The provider's raw event bodies (V4.5-197, `owner-e4-2026-08-30`).
        // Pseudonymising the account does not reach them: they carry
        // `customer_details` — e-mail, name, phone, billing address — as the
        // provider sent it, which is a direct identity this service exists to
        // destroy. Retention purges them at thirty days; erasure cannot wait
        // out that window.
        //
        // Emptied, not deleted. The rows are the accounting trace, and they
        // stay attached to an order whose user no longer names anyone.
        await transaction.paymentEvent.updateMany({
          data: { payload: Prisma.DbNull },
          where: {
            order: { userId: input.userId },
            payload: { not: Prisma.DbNull },
          },
        });
        const auditValues = {
          fromStatus: existing.accountStatus,
          learnerTextPolicy: LEARNER_TEXT_POLICY,
          previousUpdatedAt: existing.updatedAt.toISOString(),
        };
        await writeAuditEvent(transaction, {
          action: AuditAction.ACCOUNT_PSEUDONYMISE,
          actorUserId: input.actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.ACCOUNT_PSEUDONYMISE,
            input.userId,
            auditValues,
          ),
          metadata: auditValues,
          targetId: input.userId,
          targetType: 'user',
        });
        return { kind: 'ERASED' } as const;
      });
    },
  };
}
