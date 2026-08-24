ALTER TYPE "ai_correction_status" ADD VALUE 'settlement_pending';
ALTER TYPE "ai_correction_status" ADD VALUE 'release_pending';
ALTER TYPE "ai_correction_status" ADD VALUE 'reconciliation_required';

CREATE TYPE "ai_correction_financial_status" AS ENUM (
  'pending',
  'reconciliation_required',
  'ready_to_settle',
  'settled',
  'released'
);

CREATE TYPE "ai_provider_dispatch_status" AS ENUM (
  'pending',
  'sent',
  'confirmed',
  'orphaned'
);

CREATE UNIQUE INDEX "ai_pricing_quotes_id_user_id_key"
  ON "ai_pricing_quotes"("id", "user_id");
CREATE UNIQUE INDEX "credit_reservations_id_user_id_key"
  ON "credit_reservations"("id", "user_id");

ALTER TABLE "credit_reservations"
  ADD COLUMN "execution_lease_expires_at" TIMESTAMP(3);

ALTER TABLE "ai_pricing_quotes"
  ADD COLUMN "pipeline_version_id" UUID;
ALTER TABLE "ai_pricing_quotes"
  ADD CONSTRAINT "ai_pricing_quotes_pipeline_version_id_fkey"
    FOREIGN KEY ("pipeline_version_id") REFERENCES "ai_correction_pipeline_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_pricing_quotes"
  ADD CONSTRAINT "ai_pricing_quotes_composite_pipeline_check" CHECK (
    "workflow_kind" = 'single_model' OR "pipeline_version_id" IS NOT NULL
  );

ALTER TABLE "ai_corrections"
  ADD COLUMN "pricing_quote_id" UUID,
  ADD COLUMN "credit_reservation_id" UUID,
  ADD COLUMN "orchestration_fingerprint" CHAR(64),
  ADD COLUMN "started_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "ai_corrections_pricing_quote_id_key"
  ON "ai_corrections"("pricing_quote_id");
CREATE UNIQUE INDEX "ai_corrections_credit_reservation_id_key"
  ON "ai_corrections"("credit_reservation_id");
CREATE UNIQUE INDEX "ai_corrections_pricing_quote_id_user_id_key"
  ON "ai_corrections"("pricing_quote_id", "user_id");
CREATE UNIQUE INDEX "ai_corrections_credit_reservation_id_user_id_key"
  ON "ai_corrections"("credit_reservation_id", "user_id");

ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_pricing_quote_user_fkey"
    FOREIGN KEY ("pricing_quote_id", "user_id")
    REFERENCES "ai_pricing_quotes"("id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_corrections_credit_reservation_user_fkey"
    FOREIGN KEY ("credit_reservation_id", "user_id")
    REFERENCES "credit_reservations"("id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_corrections_orchestration_fingerprint_check" CHECK (
    "orchestration_fingerprint" IS NULL OR
    "orchestration_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "ai_corrections_composite_financing_check" CHECK (
    "pipeline_kind" = 'single_model' OR (
      "pricing_quote_id" IS NOT NULL AND
      "credit_reservation_id" IS NOT NULL AND
      "orchestration_fingerprint" IS NOT NULL
    )
  );

ALTER TABLE "ai_correction_role_executions"
  ADD COLUMN "lease_token" TEXT,
  ADD COLUMN "lease_owner" TEXT,
  ADD COLUMN "started_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "ai_correction_role_executions_lease_token_key"
  ON "ai_correction_role_executions"("lease_token");

ALTER TABLE "ai_correction_attempts"
  ADD COLUMN "provider_idempotency_key" TEXT,
  ADD COLUMN "dispatch_status" "ai_provider_dispatch_status",
  ADD COLUMN "cost_confirmed_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "ai_correction_attempts_provider_idempotency_key_key"
  ON "ai_correction_attempts"("provider_idempotency_key");

CREATE TABLE "ai_correction_financial_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "correction_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "ai_correction_financial_status" NOT NULL DEFAULT 'pending',
  "accepted_ceiling_credits" BIGINT NOT NULL,
  "settled_credits" BIGINT,
  "released_credits" BIGINT,
  "provider_cost_usd" DECIMAL(18,8),
  "billable_provider_cost_usd" DECIMAL(18,8),
  "absorbed_provider_cost_usd" DECIMAL(18,8),
  "absorbed_ceiling_overrun_credits" BIGINT,
  "allocation_snapshot_json" JSONB NOT NULL,
  "settlement_snapshot_json" JSONB,
  "reconciliation_code" TEXT,
  "alert_required" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_correction_financial_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_correction_financial_amounts_check" CHECK (
    "accepted_ceiling_credits" > 0 AND
    ("settled_credits" IS NULL OR "settled_credits" >= 0) AND
    ("released_credits" IS NULL OR "released_credits" >= 0) AND
    ("absorbed_ceiling_overrun_credits" IS NULL OR "absorbed_ceiling_overrun_credits" >= 0) AND
    ("provider_cost_usd" IS NULL OR "provider_cost_usd" >= 0) AND
    ("billable_provider_cost_usd" IS NULL OR "billable_provider_cost_usd" >= 0) AND
    ("absorbed_provider_cost_usd" IS NULL OR "absorbed_provider_cost_usd" >= 0)
  ),
  CONSTRAINT "ai_correction_financial_terminal_check" CHECK (
    ("status" IN ('pending', 'reconciliation_required', 'ready_to_settle') AND "completed_at" IS NULL) OR
    ("status" = 'settled' AND "settled_credits" IS NOT NULL AND "released_credits" IS NOT NULL AND
      "settled_credits" + "released_credits" = "accepted_ceiling_credits" AND "completed_at" IS NOT NULL) OR
    ("status" = 'released' AND "settled_credits" = 0 AND
      "released_credits" = "accepted_ceiling_credits" AND "completed_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ai_correction_financial_operations_correction_id_key"
  ON "ai_correction_financial_operations"("correction_id");
CREATE UNIQUE INDEX "ai_correction_financial_operations_reservation_id_key"
  ON "ai_correction_financial_operations"("reservation_id");
CREATE UNIQUE INDEX "ai_correction_financial_operations_reservation_id_user_id_key"
  ON "ai_correction_financial_operations"("reservation_id", "user_id");
CREATE INDEX "ai_correction_financial_operations_status_updated_at_idx"
  ON "ai_correction_financial_operations"("status", "updated_at");
CREATE INDEX "ai_correction_financial_operations_user_id_created_at_idx"
  ON "ai_correction_financial_operations"("user_id", "created_at");

ALTER TABLE "ai_correction_financial_operations"
  ADD CONSTRAINT "ai_correction_financial_operations_correction_id_fkey"
    FOREIGN KEY ("correction_id") REFERENCES "ai_corrections"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_correction_financial_operations_reservation_user_fkey"
    FOREIGN KEY ("reservation_id", "user_id")
    REFERENCES "credit_reservations"("id", "user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_corrections" DROP CONSTRAINT "ai_corrections_terminal_result_check";
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_terminal_result_check" CHECK (
  (
    "pipeline_kind" = 'single_model' AND (
      ("status" = 'completed' AND "decision" IN ('passed', 'not_passed') AND
       "structured_result_json" IS NOT NULL AND "score" IS NOT NULL AND
       "confidence" IS NOT NULL AND "completed_at" IS NOT NULL) OR
      ("status" = 'ai_review_required' AND "decision" = 'review_required' AND
       "structured_result_json" IS NOT NULL AND "score" IS NOT NULL AND
       "confidence" IS NOT NULL AND "completed_at" IS NOT NULL) OR
      ("status" NOT IN ('completed', 'ai_review_required') AND "decision" IS NULL AND
       "structured_result_json" IS NULL AND "score" IS NULL AND "confidence" IS NULL)
    )
  ) OR (
    "pipeline_kind" = 'composite' AND "decision" IS NULL AND "score" IS NULL AND
    "confidence" IS NULL AND (
      ("status" IN ('completed', 'provisional') AND "consolidation_json" IS NOT NULL AND
       "structured_result_json" IS NOT NULL AND "indicative_score" IS NOT NULL AND
       "completed_at" IS NOT NULL) OR
      ("status" = 'uncertain' AND "consolidation_json" IS NOT NULL AND
       "indicative_score" IS NULL AND "completed_at" IS NOT NULL) OR
      ("status" IN ('unusable_released', 'failed_released') AND
       "structured_result_json" IS NULL AND "indicative_score" IS NULL AND
       "completed_at" IS NOT NULL) OR
      ("status" IN ('reserved', 'processing_primary', 'verifying', 'retry_pending',
                    'settlement_pending', 'release_pending', 'reconciliation_required') AND
       "completed_at" IS NULL)
    )
  )
);
