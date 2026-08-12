CREATE TYPE "credit_policy_status" AS ENUM ('draft', 'inactive', 'active', 'retired');
CREATE TYPE "credit_increase_request_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'credit_increase_request_review';

ALTER TABLE "credit_lots" DROP CONSTRAINT "credit_lots_expiry_check";
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_expiry_check" CHECK (
  "provenance" = 'free_allocation' OR
  ("provenance" = 'purchased' AND "expires_at" IS NULL)
);

CREATE TABLE "credit_allocation_policy_versions" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "credit_policy_status" NOT NULL DEFAULT 'draft',
  "provenance" "credit_provenance" NOT NULL,
  "allocation_amount" BIGINT,
  "consumption_priority" INTEGER,
  "renewal_configuration_json" JSONB,
  "expiration_configuration_json" JSONB,
  "carryover_configuration_json" JSONB,
  "grace_configuration_json" JSONB,
  "adjustment_configuration_json" JSONB,
  "closure_configuration_json" JSONB,
  "pre_notice_configuration_json" JSONB,
  "effective_at" TIMESTAMP(3),
  "retired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_allocation_policy_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_allocation_policy_versions_amount_check" CHECK ("allocation_amount" IS NULL OR "allocation_amount" > 0),
  CONSTRAINT "credit_allocation_policy_versions_priority_check" CHECK ("consumption_priority" IS NULL OR "consumption_priority" >= 0),
  CONSTRAINT "credit_allocation_policy_versions_active_check" CHECK (
    "status" <> 'active' OR (
      "allocation_amount" IS NOT NULL AND
      "consumption_priority" IS NOT NULL AND
      "effective_at" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "credit_allocation_policy_versions_key_version_key"
  ON "credit_allocation_policy_versions"("key", "version");
CREATE UNIQUE INDEX "credit_allocation_policy_versions_id_provenance_key"
  ON "credit_allocation_policy_versions"("id", "provenance");
CREATE INDEX "credit_allocation_policy_versions_status_effective_at_idx"
  ON "credit_allocation_policy_versions"("status", "effective_at");

CREATE TABLE "credit_limit_policy_versions" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "credit_policy_status" NOT NULL DEFAULT 'draft',
  "user_id" UUID,
  "capability" TEXT,
  "action" TEXT,
  "period_configuration_json" JSONB,
  "maximum_credits" BIGINT,
  "maximum_concurrent_actions" INTEGER,
  "global_budget_credits" BIGINT,
  "warning_threshold_credits" BIGINT,
  "effective_at" TIMESTAMP(3),
  "retired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_limit_policy_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_limit_policy_versions_values_check" CHECK (
    ("maximum_credits" IS NULL OR "maximum_credits" >= 0) AND
    ("maximum_concurrent_actions" IS NULL OR "maximum_concurrent_actions" > 0) AND
    ("global_budget_credits" IS NULL OR "global_budget_credits" >= 0) AND
    ("warning_threshold_credits" IS NULL OR "warning_threshold_credits" >= 0)
  ),
  CONSTRAINT "credit_limit_policy_versions_active_check" CHECK (
    "status" <> 'active' OR (
      "effective_at" IS NOT NULL AND
      "period_configuration_json" IS NOT NULL AND
      COALESCE("maximum_credits", "global_budget_credits") IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "credit_limit_policy_versions_key_version_key"
  ON "credit_limit_policy_versions"("key", "version");
CREATE INDEX "credit_limit_policy_versions_status_user_id_capability_action_idx"
  ON "credit_limit_policy_versions"("status", "user_id", "capability", "action");

ALTER TABLE "credit_lots" ADD COLUMN "allocation_policy_id" UUID;
ALTER TABLE "credit_lots"
  ADD CONSTRAINT "credit_lots_allocation_policy_id_fkey"
  FOREIGN KEY ("allocation_policy_id", "provenance") REFERENCES "credit_allocation_policy_versions"("id", "provenance")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "credit_lots_allocation_policy_id_created_at_idx"
  ON "credit_lots"("allocation_policy_id", "created_at");

CREATE TABLE "credit_grant_cycles" (
  "id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "policy_version_id" UUID NOT NULL,
  "cycle_key" TEXT NOT NULL,
  "lot_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_grant_cycles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_grant_cycles_cycle_key_check" CHECK (LENGTH(BTRIM("cycle_key")) > 0),
  CONSTRAINT "credit_grant_cycles_idempotency_key_check" CHECK (LENGTH(BTRIM("idempotency_key")) >= 8),
  CONSTRAINT "credit_grant_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "credit_grant_cycles_account_id_user_id_fkey" FOREIGN KEY ("account_id", "user_id") REFERENCES "credit_accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "credit_grant_cycles_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "credit_allocation_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "credit_grant_cycles_lot_id_account_id_fkey" FOREIGN KEY ("lot_id", "account_id") REFERENCES "credit_lots"("id", "account_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "credit_grant_cycles_lot_id_key" ON "credit_grant_cycles"("lot_id");
CREATE UNIQUE INDEX "credit_grant_cycles_lot_id_account_id_key"
  ON "credit_grant_cycles"("lot_id", "account_id");
CREATE UNIQUE INDEX "credit_grant_cycles_user_id_policy_version_id_cycle_key_key"
  ON "credit_grant_cycles"("user_id", "policy_version_id", "cycle_key");
CREATE UNIQUE INDEX "credit_grant_cycles_user_id_idempotency_key_key"
  ON "credit_grant_cycles"("user_id", "idempotency_key");
CREATE INDEX "credit_grant_cycles_policy_version_id_cycle_key_idx"
  ON "credit_grant_cycles"("policy_version_id", "cycle_key");

CREATE TABLE "credit_increase_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "credit_increase_request_status" NOT NULL DEFAULT 'pending',
  "reason" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "reviewed_by_user_id" UUID,
  "review_reason" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_increase_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_increase_requests_reason_check" CHECK (LENGTH(BTRIM("reason")) BETWEEN 8 AND 1000),
  CONSTRAINT "credit_increase_requests_review_check" CHECK (
    ("status" = 'pending' AND "reviewed_by_user_id" IS NULL AND "reviewed_at" IS NULL) OR
    ("status" <> 'pending' AND "reviewed_by_user_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  ),
  CONSTRAINT "credit_increase_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "credit_increase_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "credit_increase_requests_user_id_created_at_idx"
  ON "credit_increase_requests"("user_id", "created_at");
CREATE UNIQUE INDEX "credit_increase_requests_user_id_idempotency_key_key"
  ON "credit_increase_requests"("user_id", "idempotency_key");
CREATE INDEX "credit_increase_requests_status_created_at_idx"
  ON "credit_increase_requests"("status", "created_at");

CREATE OR REPLACE FUNCTION "prevent_credit_lot_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit lots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "credit_lots_immutable"
BEFORE UPDATE OR DELETE ON "credit_lots"
FOR EACH ROW EXECUTE FUNCTION "prevent_credit_lot_mutation"();

CREATE OR REPLACE FUNCTION "prevent_credit_reservation_allocation_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit reservation allocations are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "credit_reservation_allocations_immutable"
BEFORE UPDATE OR DELETE ON "credit_reservation_allocations"
FOR EACH ROW EXECUTE FUNCTION "prevent_credit_reservation_allocation_mutation"();

CREATE OR REPLACE FUNCTION "prevent_credit_account_projection_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."free_balance" IS DISTINCT FROM OLD."free_balance"
     OR NEW."purchased_balance" IS DISTINCT FROM OLD."purchased_balance" THEN
    RAISE EXCEPTION 'credit account balances are derived from the ledger';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "credit_account_balances_are_derived"
BEFORE UPDATE ON "credit_accounts"
FOR EACH ROW EXECUTE FUNCTION "prevent_credit_account_projection_mutation"();
