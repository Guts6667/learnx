CREATE TYPE "ai_pricing_catalog_status" AS ENUM ('draft', 'inactive', 'active', 'retired');
CREATE TYPE "ai_pricing_action" AS ENUM (
  'standard',
  'detailed',
  'reinforced',
  'reconsideration',
  'future_reserved'
);
CREATE TYPE "ai_pricing_input_size_class" AS ENUM ('short', 'medium', 'long');
CREATE TYPE "ai_pricing_target_kind" AS ENUM (
  'exercise_submission',
  'stage_assessment_submission'
);

CREATE TABLE "ai_pricing_catalog_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "status" "ai_pricing_catalog_status" NOT NULL DEFAULT 'draft',
  "currency" "credit_currency" NOT NULL DEFAULT 'learnx_credit',
  "language" VARCHAR(10) NOT NULL,
  "benchmark_id" TEXT NOT NULL,
  "corpus_id" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model_id" TEXT NOT NULL,
  "provider_rate_card_version" TEXT,
  "provider_rate_card_effective_at" TIMESTAMP(3),
  "uses_promotional_provider_rates" BOOLEAN NOT NULL DEFAULT false,
  "credits_per_euro" INTEGER,
  "quote_ttl_seconds" INTEGER NOT NULL,
  "effective_at" TIMESTAMP(3),
  "retired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_pricing_catalog_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_pricing_catalog_version_format_check" CHECK (
    "version" ~ '^\\d+\\.\\d+\\.\\d+$'
  ),
  CONSTRAINT "ai_pricing_catalog_language_check" CHECK (
    "language" ~ '^[a-z]{2}(?:-[A-Z]{2})?$'
  ),
  CONSTRAINT "ai_pricing_catalog_ttl_check" CHECK (
    "quote_ttl_seconds" BETWEEN 60 AND 86400
  ),
  CONSTRAINT "ai_pricing_catalog_credit_parity_check" CHECK (
    "credits_per_euro" IS NULL OR "credits_per_euro" > 0
  ),
  CONSTRAINT "ai_pricing_catalog_active_rate_card_check" CHECK (
    "status" <> 'active' OR (
      "provider_rate_card_version" IS NOT NULL AND
      "provider_rate_card_effective_at" IS NOT NULL AND
      "credits_per_euro" IS NOT NULL AND
      "uses_promotional_provider_rates" = false
    )
  ),
  CONSTRAINT "ai_pricing_catalog_lifecycle_check" CHECK (
    ("status" = 'draft' AND "effective_at" IS NULL AND "retired_at" IS NULL) OR
    ("status" = 'inactive' AND "effective_at" IS NULL AND "retired_at" IS NULL) OR
    ("status" = 'active' AND "effective_at" IS NOT NULL AND "retired_at" IS NULL) OR
    ("status" = 'retired' AND "effective_at" IS NOT NULL AND "retired_at" IS NOT NULL)
  )
);

CREATE TABLE "ai_pricing_catalog_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "catalog_version_id" UUID NOT NULL,
  "action" "ai_pricing_action" NOT NULL,
  "input_size_class" "ai_pricing_input_size_class" NOT NULL,
  "min_input_chars" INTEGER NOT NULL,
  "max_input_chars" INTEGER,
  "provider_median_cost_usd" DECIMAL(18,8) NOT NULL,
  "provider_p90_cost_usd" DECIMAL(18,8) NOT NULL,
  "provider_median_cost_credits" BIGINT NOT NULL,
  "provider_p90_cost_credits" BIGINT NOT NULL,
  "fee_credits" BIGINT NOT NULL,
  "target_margin_credits" BIGINT NOT NULL,
  "floor_credits" BIGINT NOT NULL,
  "safety_coefficient" DECIMAL(8,4) NOT NULL,
  "includes_automatic_second_pass" BOOLEAN NOT NULL DEFAULT false,
  "verification_evidence_id" TEXT,
  "status" "ai_pricing_catalog_status" NOT NULL DEFAULT 'draft',
  "measured_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_pricing_catalog_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_pricing_entry_range_check" CHECK (
    "min_input_chars" >= 0 AND
    ("max_input_chars" IS NULL OR "max_input_chars" >= "min_input_chars")
  ),
  CONSTRAINT "ai_pricing_entry_cost_check" CHECK (
    "provider_median_cost_usd" >= 0 AND
    "provider_p90_cost_usd" >= "provider_median_cost_usd" AND
    "provider_median_cost_credits" >= 0 AND
    "provider_p90_cost_credits" >= "provider_median_cost_credits" AND
    "fee_credits" >= 0 AND
    "target_margin_credits" >= 0 AND
    "floor_credits" > 0 AND
    "safety_coefficient" >= 1
  ),
  CONSTRAINT "ai_pricing_future_action_disabled_check" CHECK (
    "action" <> 'future_reserved' OR "status" <> 'active'
  ),
  CONSTRAINT "ai_pricing_reinforced_evidence_check" CHECK (
    "action" <> 'reinforced' OR "status" <> 'active' OR
    LENGTH(BTRIM("verification_evidence_id")) > 0
  )
);

CREATE TABLE "ai_pricing_quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "catalog_version_id" UUID NOT NULL,
  "catalog_entry_id" UUID NOT NULL,
  "action" "ai_pricing_action" NOT NULL,
  "input_size_class" "ai_pricing_input_size_class" NOT NULL,
  "target_kind" "ai_pricing_target_kind" NOT NULL,
  "target_id" UUID NOT NULL,
  "contract_key" TEXT NOT NULL,
  "contract_version" TEXT NOT NULL,
  "language" VARCHAR(10) NOT NULL,
  "provider" TEXT NOT NULL,
  "model_id" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "input_chars" INTEGER NOT NULL,
  "estimated_credits" BIGINT NOT NULL,
  "ceiling_credits" BIGINT NOT NULL,
  "floor_credits" BIGINT NOT NULL,
  "provider_median_cost_usd_snapshot" DECIMAL(18,8) NOT NULL,
  "provider_p90_cost_usd_snapshot" DECIMAL(18,8) NOT NULL,
  "provider_median_credits_snapshot" BIGINT NOT NULL,
  "provider_p90_credits_snapshot" BIGINT NOT NULL,
  "fee_credits_snapshot" BIGINT NOT NULL,
  "target_margin_credits_snapshot" BIGINT NOT NULL,
  "safety_coefficient_snapshot" DECIMAL(8,4) NOT NULL,
  "includes_automatic_second_pass" BOOLEAN NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_pricing_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_pricing_quote_amount_check" CHECK (
    "input_chars" >= 0 AND
    "floor_credits" > 0 AND
    "estimated_credits" >= "floor_credits" AND
    "ceiling_credits" >= "estimated_credits" AND
    "provider_median_credits_snapshot" >= 0 AND
    "provider_p90_credits_snapshot" >= "provider_median_credits_snapshot" AND
    "fee_credits_snapshot" >= 0 AND
    "target_margin_credits_snapshot" >= 0 AND
    "safety_coefficient_snapshot" >= 1
  ),
  CONSTRAINT "ai_pricing_quote_idempotency_check" CHECK (
    LENGTH(BTRIM("idempotency_key")) BETWEEN 8 AND 200
  ),
  CONSTRAINT "ai_pricing_quote_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "ai_pricing_catalog_versions_version_key"
  ON "ai_pricing_catalog_versions"("version");
CREATE UNIQUE INDEX "ai_pricing_single_active_catalog_idx"
  ON "ai_pricing_catalog_versions"("language") WHERE "status" = 'active';
CREATE INDEX "ai_pricing_catalog_versions_status_effective_at_idx"
  ON "ai_pricing_catalog_versions"("status", "effective_at");
CREATE UNIQUE INDEX "ai_pricing_catalog_entries_catalog_version_id_action_input_size_class_key"
  ON "ai_pricing_catalog_entries"("catalog_version_id", "action", "input_size_class");
CREATE UNIQUE INDEX "ai_pricing_catalog_entries_id_catalog_version_id_key"
  ON "ai_pricing_catalog_entries"("id", "catalog_version_id");
CREATE INDEX "ai_pricing_catalog_entries_catalog_version_id_action_status_idx"
  ON "ai_pricing_catalog_entries"("catalog_version_id", "action", "status");
CREATE UNIQUE INDEX "ai_pricing_quotes_user_id_idempotency_key_key"
  ON "ai_pricing_quotes"("user_id", "idempotency_key");
CREATE INDEX "ai_pricing_quotes_user_id_created_at_idx"
  ON "ai_pricing_quotes"("user_id", "created_at");
CREATE INDEX "ai_pricing_quotes_target_kind_target_id_created_at_idx"
  ON "ai_pricing_quotes"("target_kind", "target_id", "created_at");
CREATE INDEX "ai_pricing_quotes_expires_at_idx"
  ON "ai_pricing_quotes"("expires_at");

ALTER TABLE "ai_pricing_catalog_entries"
  ADD CONSTRAINT "ai_pricing_catalog_entries_catalog_version_id_fkey"
  FOREIGN KEY ("catalog_version_id") REFERENCES "ai_pricing_catalog_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_pricing_quotes"
  ADD CONSTRAINT "ai_pricing_quotes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_pricing_quotes"
  ADD CONSTRAINT "ai_pricing_quotes_catalog_entry_version_fkey"
  FOREIGN KEY ("catalog_entry_id", "catalog_version_id")
  REFERENCES "ai_pricing_catalog_entries"("id", "catalog_version_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_ai_pricing_quote_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AI pricing quotes are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ai_pricing_quotes_immutable_update"
  BEFORE UPDATE ON "ai_pricing_quotes"
  FOR EACH ROW EXECUTE FUNCTION prevent_ai_pricing_quote_mutation();
CREATE TRIGGER "ai_pricing_quotes_immutable_delete"
  BEFORE DELETE ON "ai_pricing_quotes"
  FOR EACH ROW EXECUTE FUNCTION prevent_ai_pricing_quote_mutation();

CREATE OR REPLACE FUNCTION protect_ai_pricing_catalog_entry()
RETURNS trigger AS $$
DECLARE
  catalog_status "ai_pricing_catalog_status";
BEGIN
  SELECT "status" INTO catalog_status
  FROM "ai_pricing_catalog_versions"
  WHERE "id" = COALESCE(OLD."catalog_version_id", NEW."catalog_version_id");
  IF catalog_status NOT IN ('draft', 'inactive') THEN
    RAISE EXCEPTION 'Entries of an activated pricing catalog are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ai_pricing_catalog_entries_protected_update"
  BEFORE UPDATE ON "ai_pricing_catalog_entries"
  FOR EACH ROW EXECUTE FUNCTION protect_ai_pricing_catalog_entry();
CREATE TRIGGER "ai_pricing_catalog_entries_protected_delete"
  BEFORE DELETE ON "ai_pricing_catalog_entries"
  FOR EACH ROW EXECUTE FUNCTION protect_ai_pricing_catalog_entry();

CREATE OR REPLACE FUNCTION protect_ai_pricing_catalog_version()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" NOT IN ('draft', 'inactive') THEN
    RAISE EXCEPTION 'An activated pricing catalog cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" NOT IN ('draft', 'inactive') THEN
    IF NOT (
      OLD."status" = 'active' AND NEW."status" = 'retired' AND
      NEW."retired_at" IS NOT NULL AND
      (TO_JSONB(NEW) - 'status' - 'retired_at') =
        (TO_JSONB(OLD) - 'status' - 'retired_at')
    ) THEN
      RAISE EXCEPTION 'An activated pricing catalog is immutable';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ai_pricing_catalog_versions_protected_update"
  BEFORE UPDATE ON "ai_pricing_catalog_versions"
  FOR EACH ROW EXECUTE FUNCTION protect_ai_pricing_catalog_version();
CREATE TRIGGER "ai_pricing_catalog_versions_protected_delete"
  BEFORE DELETE ON "ai_pricing_catalog_versions"
  FOR EACH ROW EXECUTE FUNCTION protect_ai_pricing_catalog_version();
