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
 * The row itself is inserted by the migration that introduced it, not seeded:
 * the refund path would fail on a foreign key without it, so its existence is a
 * schema fact rather than something a seed script might not have run. Its
 * e-mail, `system@accounts.invalid`, is unroutable on purpose and lives only
 * there — nothing in the code needs to read it.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000001';
