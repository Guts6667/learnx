-- V4.5-162 — refunds and disputes by compensating entries.
--
-- Additive: two enum values, two columns defaulting to zero. The ledger is
-- never rewritten (ADR_003 §6): a refund adds a REFUND entry, it does not
-- modify the GRANT it compensates.
--
-- `written_off_credits` sits on the order rather than in the ledger because
-- the balance is the sum of ledger amounts — a write-off entry would move the
-- balance by exactly the amount being declared unreclaimable.
--
-- Guards qualified by the current schema, per docs/TESTING_AND_RELEASE.md.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing; the columns read as zero and no REFUND entry
-- is written. Postgres cannot drop an enum value, so leave both.
--
--   BEGIN;
--   ALTER TABLE "payment_orders"
--     DROP COLUMN IF EXISTS "refunded_credits",
--     DROP COLUMN IF EXISTS "written_off_credits";
--   COMMIT;
--
-- Dropping them discards the record of what was refunded and what was
-- absorbed, which is the only place the second number exists. Not automated.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'credit_ledger_entry_type'
      AND n.nspname = current_schema()
      AND e.enumlabel = 'refund'
  ) THEN
    ALTER TYPE "credit_ledger_entry_type" ADD VALUE 'refund';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'audit_action'
      AND n.nspname = current_schema()
      AND e.enumlabel = 'payment_refund'
  ) THEN
    ALTER TYPE "audit_action" ADD VALUE 'payment_refund';
  END IF;
END
$$;

ALTER TABLE "payment_orders"
ADD COLUMN IF NOT EXISTS "refunded_credits" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "written_off_credits" BIGINT NOT NULL DEFAULT 0;

COMMIT;
