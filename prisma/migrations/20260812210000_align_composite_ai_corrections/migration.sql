CREATE TYPE "ai_correction_pipeline_kind" AS ENUM ('single_model', 'composite');
CREATE TYPE "ai_correction_pipeline_status" AS ENUM ('draft', 'inactive', 'active', 'retired');
CREATE TYPE "ai_correction_role" AS ENUM ('primary', 'targeted_verifier');
CREATE TYPE "ai_correction_role_execution_status" AS ENUM (
  'pending', 'processing', 'succeeded', 'retry_pending', 'failed'
);
CREATE TYPE "ai_pricing_workflow_kind" AS ENUM ('single_model', 'composite');

ALTER TYPE "ai_correction_status" ADD VALUE 'processing_primary';
ALTER TYPE "ai_correction_status" ADD VALUE 'verifying';
ALTER TYPE "ai_correction_status" ADD VALUE 'provisional';
ALTER TYPE "ai_correction_status" ADD VALUE 'uncertain';
ALTER TYPE "ai_correction_status" ADD VALUE 'unusable_released';

CREATE TABLE "ai_correction_pipeline_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pipeline_key" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "ai_correction_pipeline_status" NOT NULL DEFAULT 'draft',
  "identity_fingerprint" CHAR(64) NOT NULL,
  "protocol_version" TEXT NOT NULL,
  "primary_config_json" JSONB NOT NULL,
  "verifier_config_json" JSONB NOT NULL,
  "trigger_config_json" JSONB NOT NULL,
  "consolidator_config_json" JSONB NOT NULL,
  "effective_at" TIMESTAMP(3),
  "retired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_correction_pipeline_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_correction_pipeline_version_format_check" CHECK (
    "version" ~ '^\d+\.\d+\.\d+$' AND
    "protocol_version" ~ '^\d+\.\d+\.\d+$'
  ),
  CONSTRAINT "ai_correction_pipeline_fingerprint_check" CHECK (
    "identity_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ai_correction_pipeline_lifecycle_check" CHECK (
    ("status" IN ('draft', 'inactive') AND "effective_at" IS NULL AND "retired_at" IS NULL) OR
    ("status" = 'active' AND "effective_at" IS NOT NULL AND "retired_at" IS NULL) OR
    ("status" = 'retired' AND "effective_at" IS NOT NULL AND "retired_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ai_correction_pipeline_versions_pipeline_key_version_key"
  ON "ai_correction_pipeline_versions"("pipeline_key", "version");
CREATE UNIQUE INDEX "ai_correction_pipeline_versions_id_identity_fingerprint_key"
  ON "ai_correction_pipeline_versions"("id", "identity_fingerprint");
CREATE INDEX "ai_correction_pipeline_versions_status_effective_at_idx"
  ON "ai_correction_pipeline_versions"("status", "effective_at");

ALTER TABLE "ai_corrections"
  ADD COLUMN "pipeline_kind" "ai_correction_pipeline_kind" NOT NULL DEFAULT 'single_model',
  ADD COLUMN "pipeline_version_id" UUID,
  ADD COLUMN "pipeline_identity_snapshot_json" JSONB,
  ADD COLUMN "trigger_decision_json" JSONB,
  ADD COLUMN "consolidation_json" JSONB,
  ADD COLUMN "indicative_score" DOUBLE PRECISION,
  ADD COLUMN "score_range_json" JSONB;

ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_pipeline_version_id_fkey"
  FOREIGN KEY ("pipeline_version_id") REFERENCES "ai_correction_pipeline_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_indicative_score_check" CHECK (
    "indicative_score" IS NULL OR ("indicative_score" >= 0 AND "indicative_score" <= 100)
  ),
  ADD CONSTRAINT "ai_corrections_composite_identity_check" CHECK (
    "pipeline_kind" = 'single_model' OR (
      "pipeline_version_id" IS NOT NULL AND
      "pipeline_identity_snapshot_json" IS NOT NULL AND
      "decision" IS NULL
    )
  );

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
      ("status" IN ('reserved', 'processing_primary', 'verifying', 'retry_pending') AND
       "completed_at" IS NULL)
    )
  )
);

CREATE TABLE "ai_correction_role_executions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "correction_id" UUID NOT NULL,
  "role" "ai_correction_role" NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 1,
  "status" "ai_correction_role_execution_status" NOT NULL DEFAULT 'pending',
  "assignment_snapshot_json" JSONB NOT NULL,
  "prompt_snapshot_json" JSONB NOT NULL,
  "profile_snapshot_json" JSONB NOT NULL,
  "canonical_result_json" JSONB,
  "rejection_code" TEXT,
  "lease_expires_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_correction_role_executions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_correction_role_executions_ordinal_check" CHECK ("ordinal" > 0)
);
CREATE UNIQUE INDEX "ai_correction_role_executions_correction_id_role_ordinal_key"
  ON "ai_correction_role_executions"("correction_id", "role", "ordinal");
CREATE INDEX "ai_correction_role_executions_status_lease_expires_at_idx"
  ON "ai_correction_role_executions"("status", "lease_expires_at");
ALTER TABLE "ai_correction_role_executions"
  ADD CONSTRAINT "ai_correction_role_executions_correction_id_fkey"
  FOREIGN KEY ("correction_id") REFERENCES "ai_corrections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_correction_attempts"
  ADD COLUMN "role_execution_id" UUID,
  ADD COLUMN "attempt_number" INTEGER,
  ADD COLUMN "raw_output_json" JSONB,
  ADD COLUMN "validation_code" TEXT,
  ADD COLUMN "provider_request_id" TEXT,
  ADD COLUMN "model_snapshot" TEXT,
  ADD COLUMN "reasoning_tokens" INTEGER;
CREATE UNIQUE INDEX "ai_correction_attempts_role_execution_id_attempt_number_key"
  ON "ai_correction_attempts"("role_execution_id", "attempt_number");
ALTER TABLE "ai_correction_attempts"
  ADD CONSTRAINT "ai_correction_attempts_role_execution_id_fkey"
  FOREIGN KEY ("role_execution_id") REFERENCES "ai_correction_role_executions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_correction_attempts"
  ADD CONSTRAINT "ai_correction_attempts_composite_attempt_check" CHECK (
    ("role_execution_id" IS NULL AND "attempt_number" IS NULL) OR
    ("role_execution_id" IS NOT NULL AND "attempt_number" > 0)
  );

ALTER TABLE "ai_pricing_catalog_versions"
  ADD COLUMN "workflow_kind" "ai_pricing_workflow_kind" NOT NULL DEFAULT 'single_model',
  ADD COLUMN "pipeline_version_id" UUID,
  ADD COLUMN "pipeline_identity_snapshot_json" JSONB,
  ADD COLUMN "cost_dimensions_json" JSONB;
ALTER TABLE "ai_pricing_catalog_versions"
  ADD CONSTRAINT "ai_pricing_catalog_versions_pipeline_version_id_fkey"
  FOREIGN KEY ("pipeline_version_id") REFERENCES "ai_correction_pipeline_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_pricing_catalog_composite_identity_check" CHECK (
    "workflow_kind" = 'single_model' OR (
      "pipeline_version_id" IS NOT NULL AND
      "pipeline_identity_snapshot_json" IS NOT NULL AND
      "cost_dimensions_json" IS NOT NULL AND
      "status" IN ('draft', 'inactive')
    )
  );
ALTER TABLE "ai_pricing_catalog_entries"
  ADD COLUMN "includes_targeted_verification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_pricing_quotes"
  ADD COLUMN "includes_targeted_verification" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "workflow_kind" "ai_pricing_workflow_kind" NOT NULL DEFAULT 'single_model',
  ADD COLUMN "pipeline_identity_snapshot_json" JSONB,
  ADD COLUMN "cost_dimensions_snapshot_json" JSONB,
  ADD CONSTRAINT "ai_pricing_quote_composite_identity_check" CHECK (
    "workflow_kind" = 'single_model' OR (
      "pipeline_identity_snapshot_json" IS NOT NULL AND
      "cost_dimensions_snapshot_json" IS NOT NULL AND
      "includes_targeted_verification" = true
    )
  );

CREATE OR REPLACE FUNCTION protect_ai_correction_pipeline_version()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" NOT IN ('draft', 'inactive') THEN
    RAISE EXCEPTION 'An activated correction pipeline cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" NOT IN ('draft', 'inactive') THEN
    IF NOT (
      OLD."status" = 'active' AND NEW."status" = 'retired' AND
      NEW."retired_at" IS NOT NULL AND
      (TO_JSONB(NEW) - 'status' - 'retired_at') =
        (TO_JSONB(OLD) - 'status' - 'retired_at')
    ) THEN
      RAISE EXCEPTION 'An activated correction pipeline is immutable';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ai_correction_pipeline_versions_protected_update"
  BEFORE UPDATE ON "ai_correction_pipeline_versions"
  FOR EACH ROW EXECUTE FUNCTION protect_ai_correction_pipeline_version();
CREATE TRIGGER "ai_correction_pipeline_versions_protected_delete"
  BEFORE DELETE ON "ai_correction_pipeline_versions"
  FOR EACH ROW EXECUTE FUNCTION protect_ai_correction_pipeline_version();
