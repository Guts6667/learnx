-- V4-010-R3 — one argued reconsideration per delivered correction.
-- The learner argument is bounded and stored separately from the immutable
-- submission snapshot. Quotes may expire and be recreated; the unique guard is
-- therefore applied only when the reconsideration correction actually starts.

ALTER TABLE "ai_pricing_quotes"
ADD COLUMN "reconsideration_of_correction_id" UUID,
ADD COLUMN "reconsideration_argument" VARCHAR(500);

ALTER TABLE "ai_corrections"
ADD COLUMN "reconsideration_of_id" UUID,
ADD COLUMN "reconsideration_argument" VARCHAR(500);

CREATE INDEX "ai_pricing_quotes_reconsideration_of_correction_id_created_at_idx"
ON "ai_pricing_quotes"("reconsideration_of_correction_id", "created_at");

CREATE UNIQUE INDEX "ai_corrections_reconsideration_of_id_key"
ON "ai_corrections"("reconsideration_of_id");

ALTER TABLE "ai_pricing_quotes"
ADD CONSTRAINT "ai_pricing_quotes_reconsideration_of_correction_id_fkey"
FOREIGN KEY ("reconsideration_of_correction_id") REFERENCES "ai_corrections"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_corrections"
ADD CONSTRAINT "ai_corrections_reconsideration_of_id_fkey"
FOREIGN KEY ("reconsideration_of_id") REFERENCES "ai_corrections"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_pricing_quotes"
ADD CONSTRAINT "ai_pricing_quotes_reconsideration_context_check"
CHECK (
  (
    "action" = 'reconsideration'
    AND "reconsideration_of_correction_id" IS NOT NULL
    AND "reconsideration_argument" IS NOT NULL
    AND char_length(btrim("reconsideration_argument")) BETWEEN 20 AND 500
  )
  OR (
    "action" <> 'reconsideration'
    AND "reconsideration_of_correction_id" IS NULL
    AND "reconsideration_argument" IS NULL
  )
);

ALTER TABLE "ai_corrections"
ADD CONSTRAINT "ai_corrections_reconsideration_context_check"
CHECK (
  (
    "reconsideration_of_id" IS NULL
    AND "reconsideration_argument" IS NULL
  )
  OR (
    "reconsideration_of_id" IS NOT NULL
    AND "reconsideration_argument" IS NOT NULL
    AND char_length(btrim("reconsideration_argument")) BETWEEN 20 AND 500
  )
);

-- The product owner explicitly authorizes an offered-credit-only formative
-- rollout across four text families. Scientific validation remains Writing
-- only and is preserved as a distinct field instead of being overstated.
UPDATE "ai_pricing_catalog_versions"
SET "pipeline_identity_snapshot_json" = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE("pipeline_identity_snapshot_json", '{}'::jsonb),
        '{pilotScope,activityTypes}',
        '["writing", "reflection", "practice", "project"]'::jsonb,
        true
      ),
      '{pilotScope,scientificallyValidatedActivityTypes}',
      '["writing"]'::jsonb,
      true
    ),
    '{reconsiderationPromptExtensionVersion}',
    '"1.0.0"'::jsonb,
    true
  ),
  '{pilotScope,scopeDecisionId}',
  '"owner-formative-free-text-rollout-2026-08-26"'::jsonb,
  true
) #- '{pilotScope,activityType}'
WHERE "version" = '4.0.0'
  AND "status" = 'active';

-- Reconsideration uses the same conservative pilot reserve as the primary
-- correction until dedicated observed-cost calibration is available. No pack,
-- payment SKU or purchased-credit path is activated by this entry.
INSERT INTO "ai_pricing_catalog_entries" (
  "id",
  "catalog_version_id",
  "action",
  "input_size_class",
  "min_input_chars",
  "max_input_chars",
  "provider_median_cost_usd",
  "provider_p90_cost_usd",
  "provider_median_cost_credits",
  "provider_p90_cost_credits",
  "fee_credits",
  "target_margin_credits",
  "floor_credits",
  "safety_coefficient",
  "includes_automatic_second_pass",
  "includes_targeted_verification",
  "verification_evidence_id",
  "status",
  "measured_at"
)
SELECT
  '41030000-0000-4000-8000-000000000001',
  "catalog_version_id",
  'reconsideration',
  "input_size_class",
  "min_input_chars",
  "max_input_chars",
  "provider_median_cost_usd",
  "provider_p90_cost_usd",
  "provider_median_cost_credits",
  "provider_p90_cost_credits",
  "fee_credits",
  "target_margin_credits",
  "floor_credits",
  "safety_coefficient",
  "includes_automatic_second_pass",
  "includes_targeted_verification",
  'owner-formative-reconsideration-rollout-2026-08-26',
  'active',
  TIMESTAMP '2026-08-26 12:00:00'
FROM "ai_pricing_catalog_entries"
WHERE "catalog_version_id" = '40700000-0000-4000-8000-000000000001'
  AND "action" = 'standard'
  AND "input_size_class" = 'short'
  AND "status" = 'active';
