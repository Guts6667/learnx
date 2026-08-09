CREATE TYPE "translation_workflow_status" AS ENUM (
  'draft',
  'in_review',
  'changes_requested',
  'approved'
);

ALTER TYPE "audit_action" ADD VALUE 'program_translation_workflow_update';

CREATE TABLE "program_translation_workflows" (
  "id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "source_program_version_id" UUID NOT NULL,
  "status" "translation_workflow_status" NOT NULL DEFAULT 'draft',
  "glossary_version" TEXT NOT NULL,
  "qa_checks_json" JSONB NOT NULL DEFAULT '{}',
  "linguistic_reviewer_id" UUID,
  "linguistic_reviewed_at" TIMESTAMP(3),
  "pedagogical_reviewer_id" UUID,
  "pedagogical_reviewed_at" TIMESTAMP(3),
  "cultural_legal_reviewer_id" UUID,
  "cultural_legal_reviewed_at" TIMESTAMP(3),
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "program_translation_workflows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "program_translation_workflows_program_id_key" UNIQUE ("program_id"),
  CONSTRAINT "program_translation_workflows_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_translation_workflows_source_version_fkey"
    FOREIGN KEY ("source_program_version_id") REFERENCES "program_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "program_translation_workflows_linguistic_reviewer_fkey"
    FOREIGN KEY ("linguistic_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "program_translation_workflows_pedagogical_reviewer_fkey"
    FOREIGN KEY ("pedagogical_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "program_translation_workflows_cultural_legal_reviewer_fkey"
    FOREIGN KEY ("cultural_legal_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "program_translation_workflows_approved_by_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "program_translation_workflows_source_program_version_id_idx"
ON "program_translation_workflows"("source_program_version_id");

CREATE INDEX "program_translation_workflows_status_updated_at_idx"
ON "program_translation_workflows"("status", "updated_at");
