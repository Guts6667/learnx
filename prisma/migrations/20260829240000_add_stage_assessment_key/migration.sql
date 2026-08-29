-- V4.5-117 — a stable key for stage assessments.
--
-- Additive: one column and one unique index. Exercises carry `key` and stage
-- assessments did not, so `isContractBoundToExercise`'s equivalent had nothing
-- to compare and a correction contract could be applied to the wrong
-- assessment with nothing noticing. V4.5-130 refused every stage assessment
-- for exactly that reason; this is what lets that refusal be lifted.
--
-- Existing rows are backfilled `assessment-<position>`. The rule has no
-- arithmetic on purpose: `@@unique([stageId, position])` already guarantees
-- distinct positions within a stage, so the derived key is unique without a
-- tie-break, and anyone re-deriving it later cannot disagree about an offset.
-- Authored keys replace it as content is written; the backfill exists so no
-- row is left without one.
--
-- Guards qualified by the current schema, per docs/TESTING_AND_RELEASE.md.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing; the column becomes unread and the binding
-- rule refuses again, which is the V4.5-130 behaviour.
--
--   BEGIN;
--   DROP INDEX IF EXISTS "stage_assessments_stage_id_key_key";
--   ALTER TABLE "stage_assessments" DROP COLUMN IF EXISTS "key";
--   COMMIT;
--
-- That discards authored keys, and any contract bound to one stops matching.
-- Deliberately not automated.

BEGIN;

ALTER TABLE "stage_assessments"
ADD COLUMN IF NOT EXISTS "key" TEXT NOT NULL DEFAULT '';

UPDATE "stage_assessments"
SET "key" = 'assessment-' || "position"
WHERE "key" = '';

CREATE UNIQUE INDEX IF NOT EXISTS "stage_assessments_stage_id_key_key"
ON "stage_assessments"("stage_id", "key");

COMMIT;
