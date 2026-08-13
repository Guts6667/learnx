ALTER TABLE "ai_pricing_catalog_versions"
  ADD COLUMN IF NOT EXISTS "provider_rate_card_version" TEXT,
  ADD COLUMN IF NOT EXISTS "provider_rate_card_effective_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "uses_promotional_provider_rates" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "credits_per_euro" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_pricing_catalog_credit_parity_check'
      AND conrelid = 'ai_pricing_catalog_versions'::regclass
  ) THEN
    ALTER TABLE "ai_pricing_catalog_versions"
      ADD CONSTRAINT "ai_pricing_catalog_credit_parity_check" CHECK (
        "credits_per_euro" IS NULL OR "credits_per_euro" > 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_pricing_catalog_active_rate_card_check'
      AND conrelid = 'ai_pricing_catalog_versions'::regclass
  ) THEN
    ALTER TABLE "ai_pricing_catalog_versions"
      ADD CONSTRAINT "ai_pricing_catalog_active_rate_card_check" CHECK (
        "status" <> 'active' OR (
          "provider_rate_card_version" IS NOT NULL AND
          "provider_rate_card_effective_at" IS NOT NULL AND
          "credits_per_euro" IS NOT NULL AND
          "uses_promotional_provider_rates" = false
        )
      );
  END IF;
END $$;
