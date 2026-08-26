-- V4-010-R3 — one argued reconsideration per delivered correction.
--
-- This migration may be replayed after a partially applied production attempt:
-- every schema mutation is therefore idempotent. Pricing catalog 4.0.0 is
-- immutable once active, so the expanded product scope is materialized as a
-- new 4.0.1 version and activated through an atomic catalog handover.

BEGIN;

ALTER TABLE "ai_pricing_quotes"
ADD COLUMN IF NOT EXISTS "reconsideration_of_correction_id" UUID,
ADD COLUMN IF NOT EXISTS "reconsideration_argument" VARCHAR(500);

ALTER TABLE "ai_corrections"
ADD COLUMN IF NOT EXISTS "reconsideration_of_id" UUID,
ADD COLUMN IF NOT EXISTS "reconsideration_argument" VARCHAR(500);

CREATE INDEX IF NOT EXISTS "ai_pricing_quotes_reconsideration_of_correction_id_created_at_idx"
ON "ai_pricing_quotes"("reconsideration_of_correction_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_corrections_reconsideration_of_id_key"
ON "ai_corrections"("reconsideration_of_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_pricing_quotes_reconsideration_of_correction_id_fkey'
      AND conrelid = 'ai_pricing_quotes'::regclass
  ) THEN
    ALTER TABLE "ai_pricing_quotes"
    ADD CONSTRAINT "ai_pricing_quotes_reconsideration_of_correction_id_fkey"
    FOREIGN KEY ("reconsideration_of_correction_id") REFERENCES "ai_corrections"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_corrections_reconsideration_of_id_fkey'
      AND conrelid = 'ai_corrections'::regclass
  ) THEN
    ALTER TABLE "ai_corrections"
    ADD CONSTRAINT "ai_corrections_reconsideration_of_id_fkey"
    FOREIGN KEY ("reconsideration_of_id") REFERENCES "ai_corrections"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_pricing_quotes_reconsideration_context_check'
      AND conrelid = 'ai_pricing_quotes'::regclass
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_corrections_reconsideration_context_check'
      AND conrelid = 'ai_corrections'::regclass
  ) THEN
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
  END IF;
END $$;

-- Activated catalogs are immutable. Copy 4.0.0 into a draft successor first,
-- enrich only that successor, then retire/activate both versions atomically.
INSERT INTO "ai_pricing_catalog_versions" (
  "id",
  "version",
  "status",
  "currency",
  "language",
  "benchmark_id",
  "corpus_id",
  "prompt_version",
  "provider",
  "model_id",
  "workflow_kind",
  "pipeline_version_id",
  "pipeline_identity_snapshot_json",
  "cost_dimensions_json",
  "provider_rate_card_version",
  "provider_rate_card_effective_at",
  "uses_promotional_provider_rates",
  "credits_per_euro",
  "quote_ttl_seconds"
)
SELECT
  '41030000-0000-4000-8000-000000000001',
  '4.0.1',
  'draft',
  "currency",
  "language",
  "benchmark_id",
  "corpus_id",
  "prompt_version",
  "provider",
  "model_id",
  "workflow_kind",
  "pipeline_version_id",
  jsonb_set(
    jsonb_set(
      COALESCE("pipeline_identity_snapshot_json", '{}'::jsonb),
      '{pilotScope}',
      COALESCE("pipeline_identity_snapshot_json"->'pilotScope', '{}'::jsonb)
        || jsonb_build_object(
          'activityTypes',
          '["writing", "reflection", "practice", "project"]'::jsonb,
          'scientificallyValidatedActivityTypes',
          '["writing"]'::jsonb,
          'scopeDecisionId',
          'owner-formative-free-text-rollout-2026-08-26',
          'targetKind',
          'EXERCISE',
          'offeredCreditsOnly',
          true,
          'publicSaleAuthorized',
          false,
          'maximumInputChars',
          1500
        ),
      true
    ),
    '{reconsiderationPromptExtensionVersion}',
    '"1.0.0"'::jsonb,
    true
  ) #- '{pilotScope,activityType}',
  "cost_dimensions_json",
  "provider_rate_card_version",
  "provider_rate_card_effective_at",
  "uses_promotional_provider_rates",
  "credits_per_euro",
  "quote_ttl_seconds"
FROM "ai_pricing_catalog_versions"
WHERE "version" = '4.0.0'
ON CONFLICT ("version") DO NOTHING;

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
  '41030000-0000-4000-8000-000000000002',
  '41030000-0000-4000-8000-000000000001',
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
FROM "ai_pricing_catalog_entries"
WHERE "catalog_version_id" = '40700000-0000-4000-8000-000000000001'
  AND "action" = 'standard'
  AND "input_size_class" = 'short'
  AND "status" = 'active'
ON CONFLICT ("catalog_version_id", "action", "input_size_class") DO NOTHING;

-- Reconsideration inherits the same conservative short-input reserve as the
-- primary correction until dedicated observed-cost calibration is available.
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
  '41030000-0000-4000-8000-000000000003',
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
  TIMESTAMP '2026-08-26 11:00:00'
FROM "ai_pricing_catalog_entries"
WHERE "catalog_version_id" = '41030000-0000-4000-8000-000000000001'
  AND "action" = 'standard'
  AND "input_size_class" = 'short'
ON CONFLICT ("catalog_version_id", "action", "input_size_class") DO NOTHING;

UPDATE "ai_pricing_catalog_versions"
SET
  "status" = 'retired',
  "retired_at" = TIMESTAMP '2026-08-26 11:00:00'
WHERE "version" = '4.0.0'
  AND "status" = 'active';

UPDATE "ai_pricing_catalog_versions"
SET
  "status" = 'active',
  "effective_at" = TIMESTAMP '2026-08-26 11:00:00'
WHERE "version" = '4.0.1'
  AND "status" = 'draft';

COMMIT;
