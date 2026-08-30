import type { PrismaClient } from '../../generated/prisma/client.js';

/**
 * The account actions take when no person took them (V4.5-203).
 *
 * `AuditEvent.actorUserId` is not nullable and references `User`, because until
 * now every audited act had a human behind it. A refund issued from the
 * provider's dashboard has none: the money moves, and LearnX only learns of it
 * through a webhook. Something has to be named as the actor, and naming the
 * learner would be false — they did not act.
 *
 * So there is one row that is not a person. It cannot sign in: its status is
 * SUSPENDED, and every session lookup requires ACTIVE, so the guarantee is the
 * one that already exists rather than a new promise. Its password hash is a
 * value nothing hashes to, the same device account erasure uses.
 *
 * The id is fixed rather than looked up by e-mail, so the same row is meant in
 * every environment and a typo cannot silently create a second one.
 *
 * The credit ledger needs none of this: `CreditLedgerEntry.actorUserId` is
 * already nullable, so a compensating entry says plainly that nobody human
 * acted. This account exists for the audit trail, which cannot say that.
 *
 * The row is created on first use, not by a migration and not by a seed. A
 * migration that writes into `users` fails the production-clone rehearsal —
 * "row count changed from 5 to 6, protected row checksum changed" — and that
 * guard is right: a migration describes a shape, it does not populate an
 * accounts table. A seed would be worse, because nothing guarantees it ran
 * wherever a refund arrives.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000001';

/** Unroutable on purpose: nothing should ever send to it. */
const SYSTEM_ACTOR_EMAIL = 'system@accounts.invalid';

/**
 * Creates the account if it is missing, and does nothing at all if it is not.
 *
 * `update: {}` rather than a no-op write: an upsert that touched the row on
 * every refund would move `updatedAt` and make an inert account look active.
 *
 * Called before the refund transaction rather than inside it. Threading a
 * transaction client through the refund service to gain atomicity here would
 * buy little: the upsert is idempotent, it commits before the audit event needs
 * the foreign key, and a refund that then fails leaves one unused row that is
 * already excluded from every listing.
 */
export async function ensureSystemActor(
  client: Pick<PrismaClient, 'user'>,
): Promise<string> {
  await client.user.upsert({
    create: {
      accountStatus: 'SUSPENDED',
      displayName: 'LearnX (système)',
      email: SYSTEM_ACTOR_EMAIL,
      id: SYSTEM_ACTOR_ID,
      // A value nothing hashes to, the same device account erasure uses.
      passwordHash: 'system:no-password-hashes-to-this-value',
      suspendedAt: new Date(),
    },
    update: {},
    where: { id: SYSTEM_ACTOR_ID },
  });
  return SYSTEM_ACTOR_ID;
}
