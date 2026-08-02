CREATE TYPE "stage_assessment_type" AS ENUM (
  'project',
  'case_study',
  'written_assignment',
  'practical_exercise',
  'oral',
  'simulation',
  'cumulative_exam'
);

CREATE TYPE "stage_assessment_submission_status" AS ENUM (
  'draft',
  'submitted',
  'validated',
  'needs_revision'
);

CREATE TABLE "stage_assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stage_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "stage_assessment_type" NOT NULL,
  "instructions" TEXT,
  "rubric_json" JSONB,
  "passing_score" DOUBLE PRECISION,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stage_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stage_assessment_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "stage_assessment_id" UUID NOT NULL,
  "content_markdown" TEXT,
  "attachment_url" TEXT,
  "score" DOUBLE PRECISION,
  "review_feedback" TEXT,
  "status" "stage_assessment_submission_status" NOT NULL DEFAULT 'draft',
  "submitted_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stage_assessment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stage_assessments_stage_id_position_key"
  ON "stage_assessments"("stage_id", "position");
CREATE INDEX "stage_assessments_stage_id_position_idx"
  ON "stage_assessments"("stage_id", "position");
CREATE UNIQUE INDEX "stage_assessment_submissions_user_id_stage_assessment_id_key"
  ON "stage_assessment_submissions"("user_id", "stage_assessment_id");
CREATE INDEX "stage_assessment_submissions_stage_assessment_id_status_idx"
  ON "stage_assessment_submissions"("stage_assessment_id", "status");

ALTER TABLE "stage_assessments"
  ADD CONSTRAINT "stage_assessments_stage_id_fkey"
  FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stage_assessment_submissions"
  ADD CONSTRAINT "stage_assessment_submissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stage_assessment_submissions"
  ADD CONSTRAINT "stage_assessment_submissions_stage_assessment_id_fkey"
  FOREIGN KEY ("stage_assessment_id") REFERENCES "stage_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
