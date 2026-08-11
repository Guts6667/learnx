-- CreateEnum
CREATE TYPE "ai_correction_method" AS ENUM ('deterministic', 'ai');

-- CreateEnum
CREATE TYPE "ai_correction_status" AS ENUM (
  'reserved',
  'processing',
  'completed',
  'ai_review_required',
  'retry_pending',
  'failed_released'
);

-- CreateEnum
CREATE TYPE "ai_correction_decision" AS ENUM (
  'passed',
  'not_passed',
  'review_required'
);

-- CreateEnum
CREATE TYPE "ai_correction_attempt_status" AS ENUM (
  'processing',
  'succeeded',
  'failed'
);

-- Existing submission identities become composite relation targets so that a
-- correction cannot reference a submission owned by another user.
CREATE UNIQUE INDEX "stage_assessment_submissions_id_user_id_key"
  ON "stage_assessment_submissions"("id", "user_id");
CREATE UNIQUE INDEX "exercise_submissions_id_user_id_key"
  ON "exercise_submissions"("id", "user_id");

-- CreateTable
CREATE TABLE "ai_corrections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "exercise_submission_id" UUID,
  "stage_assessment_submission_id" UUID,
  "method" "ai_correction_method" NOT NULL DEFAULT 'ai',
  "status" "ai_correction_status" NOT NULL DEFAULT 'reserved',
  "decision" "ai_correction_decision",
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "submission_snapshot_json" JSONB NOT NULL,
  "contract_snapshot_json" JSONB NOT NULL,
  "prompt_snapshot_json" JSONB NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "model_role" TEXT NOT NULL,
  "provider" TEXT,
  "model_id" TEXT,
  "structured_result_json" JSONB,
  "score" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_corrections_exactly_one_submission_check" CHECK (
    num_nonnulls("exercise_submission_id", "stage_assessment_submission_id") = 1
  ),
  CONSTRAINT "ai_corrections_idempotency_key_check" CHECK (
    LENGTH(BTRIM("idempotency_key")) BETWEEN 8 AND 200
  ),
  CONSTRAINT "ai_corrections_request_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ai_corrections_score_check" CHECK (
    "score" IS NULL OR ("score" >= 0 AND "score" <= 100)
  ),
  CONSTRAINT "ai_corrections_confidence_check" CHECK (
    "confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)
  ),
  CONSTRAINT "ai_corrections_terminal_result_check" CHECK (
    (
      "status" = 'completed' AND
      "decision" IN ('passed', 'not_passed') AND
      "structured_result_json" IS NOT NULL AND
      "score" IS NOT NULL AND
      "confidence" IS NOT NULL AND
      "completed_at" IS NOT NULL
    ) OR (
      "status" = 'ai_review_required' AND
      "decision" = 'review_required' AND
      "structured_result_json" IS NOT NULL AND
      "score" IS NOT NULL AND
      "confidence" IS NOT NULL AND
      "completed_at" IS NOT NULL
    ) OR (
      "status" NOT IN ('completed', 'ai_review_required') AND
      "decision" IS NULL AND
      "structured_result_json" IS NULL AND
      "score" IS NULL AND
      "confidence" IS NULL
    )
  )
);

-- CreateTable
CREATE TABLE "ai_correction_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "correction_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "ai_correction_attempt_status" NOT NULL DEFAULT 'processing',
  "provider" TEXT,
  "model_id" TEXT,
  "model_role" TEXT NOT NULL,
  "generation_id" TEXT,
  "structured_result_json" JSONB,
  "error_code" TEXT,
  "retryable" BOOLEAN,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "total_tokens" INTEGER,
  "cost_usd" DECIMAL(18,8),
  "latency_ms" INTEGER,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_correction_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_correction_attempts_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "ai_correction_attempts_usage_check" CHECK (
    ("prompt_tokens" IS NULL OR "prompt_tokens" >= 0) AND
    ("completion_tokens" IS NULL OR "completion_tokens" >= 0) AND
    ("total_tokens" IS NULL OR "total_tokens" >= 0) AND
    ("cost_usd" IS NULL OR "cost_usd" >= 0) AND
    ("latency_ms" IS NULL OR "latency_ms" >= 0)
  ),
  CONSTRAINT "ai_correction_attempts_result_check" CHECK (
    (
      "status" = 'processing' AND
      "completed_at" IS NULL AND
      "structured_result_json" IS NULL AND
      "error_code" IS NULL
    ) OR (
      "status" = 'succeeded' AND
      "completed_at" IS NOT NULL AND
      "provider" IS NOT NULL AND
      "model_id" IS NOT NULL AND
      "generation_id" IS NOT NULL AND
      "structured_result_json" IS NOT NULL AND
      "error_code" IS NULL AND
      "retryable" = FALSE
    ) OR (
      "status" = 'failed' AND
      "completed_at" IS NOT NULL AND
      "structured_result_json" IS NULL AND
      "error_code" IS NOT NULL AND
      "retryable" IS NOT NULL
    )
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_corrections_user_id_idempotency_key_key"
  ON "ai_corrections"("user_id", "idempotency_key");
CREATE INDEX "ai_corrections_exercise_submission_id_created_at_idx"
  ON "ai_corrections"("exercise_submission_id", "created_at");
CREATE INDEX "ai_corrections_stage_assessment_submission_id_created_at_idx"
  ON "ai_corrections"("stage_assessment_submission_id", "created_at");
CREATE INDEX "ai_corrections_status_updated_at_idx"
  ON "ai_corrections"("status", "updated_at");
CREATE UNIQUE INDEX "ai_correction_attempts_correction_id_sequence_key"
  ON "ai_correction_attempts"("correction_id", "sequence");
CREATE UNIQUE INDEX "ai_correction_attempts_provider_generation_id_key"
  ON "ai_correction_attempts"("provider", "generation_id");
CREATE INDEX "ai_correction_attempts_status_created_at_idx"
  ON "ai_correction_attempts"("status", "created_at");

-- AddForeignKey
ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_exercise_submission_id_user_id_fkey"
  FOREIGN KEY ("exercise_submission_id", "user_id")
  REFERENCES "exercise_submissions"("id", "user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_corrections"
  ADD CONSTRAINT "ai_corrections_stage_assessment_submission_id_user_id_fkey"
  FOREIGN KEY ("stage_assessment_submission_id", "user_id")
  REFERENCES "stage_assessment_submissions"("id", "user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_correction_attempts"
  ADD CONSTRAINT "ai_correction_attempts_correction_id_fkey"
  FOREIGN KEY ("correction_id") REFERENCES "ai_corrections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
