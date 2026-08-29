-- V4.5-112 — learner feedback on a corrected criterion.
--
-- Purely additive: one new enum, one new table, and one redundant unique index
-- on ai_corrections. Nothing existing is altered or dropped, so the deployed
-- application keeps working unchanged if this lands before the code that reads
-- it, and keeps working if the code is rolled back after it.
--
-- Every statement is idempotent so the migration can be replayed after a
-- partially applied production attempt, following the precedent set by
-- 20260826120000_add_correction_reconsideration.
--
-- The catalogue guards are qualified by the current schema. Without that, a
-- replay into a second schema of the same database finds the type or the
-- constraint in `public`, skips creating it, and either aborts on the
-- CREATE TABLE that references it or diverges silently.
--
-- ROLLBACK
-- ========
-- Reverting the application code alone is safe and requires nothing here: the
-- table is written only by POST /api/ai-corrections/:id/feedback and read only
-- by the correction history serializer. An older build ignores both.
--
-- To reverse the schema as well, after the code no longer references it:
--
--   BEGIN;
--   DROP TABLE IF EXISTS "ai_correction_criterion_feedback";
--   DROP TYPE IF EXISTS "ai_correction_feedback_verdict";
--   DROP INDEX IF EXISTS "ai_corrections_id_user_id_key";
--   COMMIT;
--
-- That destroys learner feedback permanently and cannot be undone, so it is
-- deliberately not automated. Prefer leaving the table in place: an unused
-- additive table costs nothing and keeps the data if the feature returns.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ai_correction_feedback_verdict'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "ai_correction_feedback_verdict" AS ENUM ('helpful', 'wrong');
  END IF;
END
$$;

-- Redundant against the primary key on purpose: it is what allows the compound
-- foreign key below, so a feedback row pointing at another learner's
-- correction is refused by the database and not only by the route.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_corrections_id_user_id_key"
ON "ai_corrections"("id", "user_id");

CREATE TABLE IF NOT EXISTS "ai_correction_criterion_feedback" (
  "id" UUID NOT NULL,
  "correction_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "criterion_key" TEXT NOT NULL,
  "verdict" "ai_correction_feedback_verdict" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_correction_criterion_feedback_pkey" PRIMARY KEY ("id")
);

-- One row per learner per criterion: a second verdict replaces the first
-- rather than adding to it, so a count of "this criterion is wrong" counts
-- people and not clicks.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_correction_criterion_feedback_correction_id_user_id_criterion_key_key"
ON "ai_correction_criterion_feedback"("correction_id", "user_id", "criterion_key");

CREATE INDEX IF NOT EXISTS "ai_correction_criterion_feedback_correction_id_idx"
ON "ai_correction_criterion_feedback"("correction_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_correction_criterion_feedback_correction_id_user_id_fkey'
      AND conrelid = 'ai_correction_criterion_feedback'::regclass
  ) THEN
    ALTER TABLE "ai_correction_criterion_feedback"
    ADD CONSTRAINT "ai_correction_criterion_feedback_correction_id_user_id_fkey"
    FOREIGN KEY ("correction_id", "user_id")
    REFERENCES "ai_corrections"("id", "user_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_correction_criterion_feedback_user_id_fkey'
      AND conrelid = 'ai_correction_criterion_feedback'::regclass
  ) THEN
    ALTER TABLE "ai_correction_criterion_feedback"
    ADD CONSTRAINT "ai_correction_criterion_feedback_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
