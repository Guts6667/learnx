-- V4.5-163B — anti-abuse markers for the trial allocation.
--
-- Additive: one table. Keyed on an HMAC of the client address under the server
-- secret (V4.5-147), so a row identifies nobody without the key.
--
-- This marker deliberately outlives an erased account. Without that, deleting
-- an account would reset the trial counter and erasure would become the very
-- bypass the limit exists to close. Legitimate interest, fraud prevention,
-- retained 12 months from last contact and purged by cleanup-expired-data.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing; the table is simply unread.
--
--   BEGIN;
--   DROP TABLE IF EXISTS "trial_allocation_markers";
--   COMMIT;
--
-- Dropping it resets every counter, which reopens the bypass. Deliberately not
-- automated.

BEGIN;

CREATE TABLE IF NOT EXISTS "trial_allocation_markers" (
  "key_hash" TEXT NOT NULL,
  "grants" INTEGER NOT NULL DEFAULT 0,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trial_allocation_markers_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX IF NOT EXISTS "trial_allocation_markers_last_seen_at_idx"
ON "trial_allocation_markers"("last_seen_at");

COMMIT;
