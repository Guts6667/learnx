-- V4-007 owner decision, 2026-08-24: bounded Writing pilot.
-- This activates offered-credit quotes only. Payment, packs and purchased-credit
-- settlement remain outside this migration and outside the V4 pilot runtime.

-- Repair the legacy semantic-version constraint before materializing the pilot.
-- The original migration used a backslash-escaped regular expression whose
-- interpretation rejects ordinary values such as 4.0.0 on PostgreSQL.
ALTER TABLE "ai_pricing_catalog_versions"
DROP CONSTRAINT IF EXISTS "ai_pricing_catalog_version_format_check";

ALTER TABLE "ai_pricing_catalog_versions"
ADD CONSTRAINT "ai_pricing_catalog_version_format_check" CHECK (
  "version" ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
);

UPDATE "ai_pricing_catalog_versions"
SET
  "status" = 'retired',
  "retired_at" = TIMESTAMP '2026-08-24 19:26:28'
WHERE "language" = 'fr-FR'
  AND "status" = 'active';

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
  "quote_ttl_seconds",
  "effective_at"
) VALUES (
  '40700000-0000-4000-8000-000000000001',
  '4.0.0',
  'active',
  'learnx_credit',
  'fr-FR',
  'learnx-french-text-correction-v3-1',
  'learnx-french-writing-holdout-v1',
  '2.2.0',
  'Anthropic',
  'anthropic/claude-sonnet-4.6',
  'single_model',
  NULL,
  NULL,
  '{
    "pilotScope": {
      "activityType": "writing",
      "targetKind": "EXERCISE",
      "offeredCreditsOnly": true,
      "publicSaleAuthorized": false,
      "maximumInputChars": 1500
    },
    "measurement": {
      "artifact": "benchmarks/ai-correction/pricing/writing-pilot-calibration-2026-08-24.json",
      "logicalRuns": 72,
      "supplierMedianUsd": 0.01968,
      "supplierP90Usd": 0.0230361,
      "loadedMaximumUsdEquivalent": 0.05897640744
    },
    "decision": {
      "key": "BOUNDED_PRODUCT_PILOT",
      "estimatedCredits": 3,
      "maximumReservedCredits": 6,
      "inputSizeExtrapolationAcknowledged": true
    }
  }'::jsonb,
  'openrouter-anthropic-sonnet-4.6-2026-08-24',
  TIMESTAMP '2026-08-24 00:00:00',
  false,
  100,
  900,
  TIMESTAMP '2026-08-24 19:26:28'
);

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
) VALUES (
  '40700000-0000-4000-8000-000000000002',
  '40700000-0000-4000-8000-000000000001',
  'standard',
  'short',
  1,
  1500,
  0.01968000,
  0.02303610,
  2,
  4,
  0,
  0,
  3,
  1.5000,
  true,
  false,
  'sha256:fe4a0f96b3362e6100d6e1632e0c4745e06a0a51b91c20a09b67ea2f860aebd1',
  'active',
  TIMESTAMP '2026-08-24 14:26:14'
);
