-- V4.5-166 — right to erasure by pseudonymisation (RGPD art. 17, audit §4 E1).
--
-- Additive: one value on `account_status`, one on `audit_action`. Nothing
-- existing is altered, so an older build ignores both and a newer build on an
-- unmigrated database simply never produces them.
--
-- Guards are qualified by the current schema, per docs/TESTING_AND_RELEASE.md:
-- an unqualified guard is correct on a fresh database and wrong on the replay
-- schema, which is the failure V4.5-144 fixed.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing here; the values are simply never written.
-- Postgres cannot drop an enum value, so reversing the schema means recreating
-- both types and rewriting every column that uses them. That is not worth
-- doing for two unused labels, and it is why this is deliberately not
-- automated: leave them in place.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_status'
      AND n.nspname = current_schema()
      AND e.enumlabel = 'pseudonymised'
  ) THEN
    ALTER TYPE "account_status" ADD VALUE 'pseudonymised';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'audit_action'
      AND n.nspname = current_schema()
      AND e.enumlabel = 'account_pseudonymise'
  ) THEN
    ALTER TYPE "audit_action" ADD VALUE 'account_pseudonymise';
  END IF;
END
$$;

COMMIT;
