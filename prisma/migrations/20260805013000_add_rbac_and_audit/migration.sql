-- Additive RBAC expansion. CREATOR remains unassigned until a later ticket.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'creator';

CREATE TYPE "audit_action" AS ENUM (
  'program_publication_apply',
  'module_update',
  'lesson_update',
  'stage_assessment_review',
  'access_request_approve',
  'access_request_reject',
  'access_invitation_issue',
  'account_role_assign',
  'account_suspend',
  'account_reactivate'
);

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" "audit_action" NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "metadata_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_target_type_check" CHECK (
    "target_type" = LOWER(BTRIM("target_type"))
    AND LENGTH("target_type") BETWEEN 1 AND 80
  ),
  CONSTRAINT "audit_events_idempotency_key_check" CHECK (
    LENGTH(BTRIM("idempotency_key")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "audit_events_metadata_object_check" CHECK (
    JSONB_TYPEOF("metadata_json") = 'object'
  )
);

CREATE UNIQUE INDEX "audit_events_actor_user_id_action_idempotency_key_key"
  ON "audit_events"("actor_user_id", "action", "idempotency_key");
CREATE INDEX "audit_events_action_created_at_idx"
  ON "audit_events"("action", "created_at");
CREATE INDEX "audit_events_target_type_target_id_created_at_idx"
  ON "audit_events"("target_type", "target_id", "created_at");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
