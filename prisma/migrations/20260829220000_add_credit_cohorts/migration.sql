-- V4.5-163 — credit cohorts and the scheduled free allocation.
--
-- Additive: one enum, one column on `users` with a backfilled default, one
-- nullable column on the allocation policy, one non-null column on
-- `credit_grant_cycles`. That last table has never been written — nothing in
-- the application references it — so a non-null column needs no backfill and
-- cannot break an existing row.
--
-- EARLY_ADOPTER is the default for existing accounts because everyone on the
-- platform today was admitted by review or invitation. Nobody arrived through
-- a public trial: there is none yet, which is what this ticket builds.
--
-- Guards qualified by the current schema, per docs/TESTING_AND_RELEASE.md.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing here; the columns become unread. Reversing the
-- schema means dropping three columns and a type:
--
--   BEGIN;
--   ALTER TABLE "credit_grant_cycles" DROP COLUMN IF EXISTS "cohort";
--   ALTER TABLE "credit_allocation_policy_versions" DROP COLUMN IF EXISTS "cohort";
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "cohort";
--   DROP TYPE IF EXISTS "credit_cohort";
--   COMMIT;
--
-- Dropping the grant-cycle column destroys the record of which cohort each
-- past allocation was made under, which is the thing that keeps a later cohort
-- edit from rewriting history. Deliberately not automated.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'credit_cohort'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "credit_cohort" AS ENUM (
      'early_adopter',
      'trial',
      'friends_family',
      'purchased'
    );
  END IF;
END
$$;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "cohort" "credit_cohort" NOT NULL DEFAULT 'early_adopter';

ALTER TABLE "credit_allocation_policy_versions"
ADD COLUMN IF NOT EXISTS "cohort" "credit_cohort";

ALTER TABLE "credit_grant_cycles"
ADD COLUMN IF NOT EXISTS "cohort" "credit_cohort" NOT NULL DEFAULT 'early_adopter';

-- The default exists only so the column can be added non-null to a table that
-- is empty today. New rows always state their cohort explicitly, so the default
-- is dropped rather than left as a value someone could silently rely on.
ALTER TABLE "credit_grant_cycles" ALTER COLUMN "cohort" DROP DEFAULT;

COMMIT;
