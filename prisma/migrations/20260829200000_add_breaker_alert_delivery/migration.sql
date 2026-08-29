-- V4.5-142 — record whether the owner alert for a breaker trip was delivered.
--
-- Additive: two nullable columns on an existing table. Idempotent, so it can be
-- replayed after a partially applied attempt. Nothing existing is altered, and
-- an older build ignores both columns.
--
-- Why they exist: the trip is written before the e-mail is attempted, so a
-- provider outage can never stop the breaker latching. That leaves an owner who
-- was never told and does not know they were not told, which is the failure
-- this ticket exists to remove. These columns make "was the owner actually
-- told" answerable instead of assumed.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing here; the columns are simply unread.
--
--   BEGIN;
--   ALTER TABLE "ai_correction_breaker_events"
--     DROP COLUMN IF EXISTS "alerted_at",
--     DROP COLUMN IF EXISTS "alert_error";
--   COMMIT;
--
-- That discards the record of which alerts reached the owner, so it is
-- deliberately not automated.

BEGIN;

ALTER TABLE "ai_correction_breaker_events"
ADD COLUMN IF NOT EXISTS "alerted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "alert_error" VARCHAR(500);

COMMIT;
