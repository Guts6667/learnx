-- V4.5-140 — circuit breaker journal for AI correction.
--
-- Additive: two enums and one table. Nothing existing is altered, so the
-- deployed application is unaffected whether this lands before the code that
-- reads it or the code is rolled back after it. Statements are idempotent so
-- the migration can be replayed after a partially applied attempt.
--
-- The catalogue guards are qualified by the current schema. Without that, a
-- replay into a second schema of the same database finds the type in `public`,
-- skips creating it, and aborts on the CREATE TABLE that references it.
--
-- The journal is append-only by design rather than a mutable state row. The
-- current state is derived from the latest event, so closing the breaker means
-- writing a line: a trip cannot be erased by flipping a flag back, and the
-- manual reopen the quality contract requires to be audited is audited by
-- construction.
--
-- ROLLBACK
-- ========
-- Reverting the code alone is safe and needs nothing here. With no rows, the
-- breaker reads CLOSED, which is its state today.
--
--   BEGIN;
--   DROP TABLE IF EXISTS "ai_correction_breaker_events";
--   DROP TYPE IF EXISTS "ai_correction_breaker_reason";
--   DROP TYPE IF EXISTS "ai_correction_breaker_action";
--   COMMIT;
--
-- That destroys the record of every trip and reopen, which is the audit trail
-- itself, so it is deliberately not automated.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ai_correction_breaker_action'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "ai_correction_breaker_action" AS ENUM ('tripped', 'reopened');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ai_correction_breaker_reason'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "ai_correction_breaker_reason" AS ENUM (
      'checker_disagreement',
      'unusable_rate',
      'learner_contradiction_at_high'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ai_correction_breaker_events" (
  "id" UUID NOT NULL,
  "action" "ai_correction_breaker_action" NOT NULL,
  "reason" "ai_correction_breaker_reason",
  "rate" DOUBLE PRECISION,
  "threshold" DOUBLE PRECISION,
  "window_size" INTEGER,
  "actor_id" UUID,
  "note" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_correction_breaker_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_correction_breaker_events_created_at_idx"
ON "ai_correction_breaker_events"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_correction_breaker_events_actor_id_fkey'
      AND conrelid = 'ai_correction_breaker_events'::regclass
  ) THEN
    ALTER TABLE "ai_correction_breaker_events"
    ADD CONSTRAINT "ai_correction_breaker_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
