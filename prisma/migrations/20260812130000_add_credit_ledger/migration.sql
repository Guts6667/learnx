-- V4-006 stores LearnX credits as integers. The ledger is the financial source
-- of truth; credit_accounts and credit_lots are rebuildable projections used
-- for locking and deterministic allocation.

ALTER TYPE "audit_action" ADD VALUE 'credit_admin_adjustment';

CREATE TYPE "credit_currency" AS ENUM ('learnx_credit');
CREATE TYPE "credit_provenance" AS ENUM ('free_allocation', 'purchased');
CREATE TYPE "credit_ledger_entry_type" AS ENUM (
  'grant',
  'reservation_hold',
  'reservation_release',
  'settlement',
  'expiration',
  'admin_adjustment'
);
CREATE TYPE "credit_reservation_status" AS ENUM (
  'reserved',
  'settled',
  'released',
  'expired_released'
);

CREATE TABLE "credit_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "currency" "credit_currency" NOT NULL DEFAULT 'learnx_credit',
  "free_balance" BIGINT NOT NULL DEFAULT 0,
  "purchased_balance" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_accounts_non_negative_check" CHECK (
    "free_balance" >= 0 AND "purchased_balance" >= 0
  )
);

CREATE TABLE "credit_lots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "provenance" "credit_provenance" NOT NULL,
  "initial_amount" BIGINT NOT NULL,
  "remaining_amount" BIGINT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "source_reference_type" TEXT NOT NULL,
  "source_reference_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_lots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_lots_amount_check" CHECK (
    "initial_amount" > 0 AND
    "remaining_amount" >= 0 AND
    "remaining_amount" <= "initial_amount"
  ),
  CONSTRAINT "credit_lots_expiry_check" CHECK (
    ("provenance" = 'free_allocation' AND "expires_at" IS NOT NULL) OR
    ("provenance" = 'purchased' AND "expires_at" IS NULL)
  ),
  CONSTRAINT "credit_lots_reference_check" CHECK (
    LENGTH(BTRIM("source_reference_type")) > 0 AND
    LENGTH(BTRIM("source_reference_id")) > 0
  )
);

CREATE TABLE "credit_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "credit_reservation_status" NOT NULL DEFAULT 'reserved',
  "ceiling_amount" BIGINT NOT NULL,
  "settled_amount" BIGINT,
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "reference_type" TEXT NOT NULL,
  "reference_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "settled_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_reservations_amount_check" CHECK (
    "ceiling_amount" > 0 AND
    ("settled_amount" IS NULL OR (
      "settled_amount" >= 0 AND "settled_amount" <= "ceiling_amount"
    ))
  ),
  CONSTRAINT "credit_reservations_idempotency_key_check" CHECK (
    LENGTH(BTRIM("idempotency_key")) BETWEEN 8 AND 200
  ),
  CONSTRAINT "credit_reservations_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "credit_reservations_reference_check" CHECK (
    LENGTH(BTRIM("reference_type")) > 0 AND
    LENGTH(BTRIM("reference_id")) > 0
  ),
  CONSTRAINT "credit_reservations_state_check" CHECK (
    ("status" = 'reserved' AND "settled_amount" IS NULL AND "settled_at" IS NULL AND "released_at" IS NULL) OR
    ("status" = 'settled' AND "settled_amount" IS NOT NULL AND "settled_at" IS NOT NULL AND "released_at" IS NULL) OR
    ("status" IN ('released', 'expired_released') AND "settled_amount" IS NULL AND "settled_at" IS NULL AND "released_at" IS NOT NULL)
  )
);

CREATE TABLE "credit_reservation_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "lot_id" UUID NOT NULL,
  "amount" BIGINT NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_reservation_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_reservation_allocations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "credit_reservation_allocations_position_check" CHECK ("position" > 0)
);

CREATE TABLE "credit_ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "lot_id" UUID NOT NULL,
  "reservation_id" UUID,
  "currency" "credit_currency" NOT NULL DEFAULT 'learnx_credit',
  "provenance" "credit_provenance" NOT NULL,
  "type" "credit_ledger_entry_type" NOT NULL,
  "amount" BIGINT NOT NULL,
  "operation_key" TEXT NOT NULL,
  "operation_sequence" INTEGER NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "reference_type" TEXT NOT NULL,
  "reference_id" TEXT NOT NULL,
  "reason" TEXT,
  "actor_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_ledger_entries_amount_check" CHECK ("amount" <> 0),
  CONSTRAINT "credit_ledger_entries_sequence_check" CHECK ("operation_sequence" > 0),
  CONSTRAINT "credit_ledger_entries_operation_key_check" CHECK (
    LENGTH(BTRIM("operation_key")) BETWEEN 8 AND 240
  ),
  CONSTRAINT "credit_ledger_entries_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "credit_ledger_entries_reference_check" CHECK (
    LENGTH(BTRIM("reference_type")) > 0 AND
    LENGTH(BTRIM("reference_id")) > 0
  ),
  CONSTRAINT "credit_ledger_entries_type_check" CHECK (
    ("type" = 'grant' AND "amount" > 0 AND "reservation_id" IS NULL) OR
    ("type" = 'reservation_hold' AND "amount" < 0 AND "reservation_id" IS NOT NULL) OR
    ("type" = 'reservation_release' AND "amount" > 0 AND "reservation_id" IS NOT NULL) OR
    ("type" = 'settlement' AND "amount" < 0 AND "reservation_id" IS NOT NULL) OR
    ("type" = 'expiration' AND "amount" < 0 AND "reservation_id" IS NULL) OR
    ("type" = 'admin_adjustment' AND "reservation_id" IS NULL)
  ),
  CONSTRAINT "credit_ledger_entries_admin_audit_check" CHECK (
    ("type" = 'admin_adjustment' AND "actor_user_id" IS NOT NULL AND LENGTH(BTRIM("reason")) > 0) OR
    ("type" <> 'admin_adjustment' AND "actor_user_id" IS NULL AND "reason" IS NULL)
  )
);

CREATE UNIQUE INDEX "credit_accounts_user_id_currency_key"
  ON "credit_accounts"("user_id", "currency");
CREATE UNIQUE INDEX "credit_accounts_id_user_id_key"
  ON "credit_accounts"("id", "user_id");
CREATE UNIQUE INDEX "credit_lots_id_account_id_key"
  ON "credit_lots"("id", "account_id");
CREATE INDEX "credit_lots_account_id_provenance_expires_at_created_at_idx"
  ON "credit_lots"("account_id", "provenance", "expires_at", "created_at");
CREATE UNIQUE INDEX "credit_reservations_account_id_idempotency_key_key"
  ON "credit_reservations"("account_id", "idempotency_key");
CREATE UNIQUE INDEX "credit_reservations_id_account_id_key"
  ON "credit_reservations"("id", "account_id");
CREATE INDEX "credit_reservations_status_expires_at_idx"
  ON "credit_reservations"("status", "expires_at");
CREATE UNIQUE INDEX "credit_reservation_allocations_reservation_id_lot_id_key"
  ON "credit_reservation_allocations"("reservation_id", "lot_id");
CREATE UNIQUE INDEX "credit_reservation_allocations_reservation_id_position_key"
  ON "credit_reservation_allocations"("reservation_id", "position");
CREATE INDEX "credit_reservation_allocations_account_id_lot_id_idx"
  ON "credit_reservation_allocations"("account_id", "lot_id");
CREATE UNIQUE INDEX "credit_ledger_entries_account_id_operation_key_operation_sequence_key"
  ON "credit_ledger_entries"("account_id", "operation_key", "operation_sequence");
CREATE INDEX "credit_ledger_entries_account_id_created_at_id_idx"
  ON "credit_ledger_entries"("account_id", "created_at", "id");
CREATE INDEX "credit_ledger_entries_reservation_id_created_at_idx"
  ON "credit_ledger_entries"("reservation_id", "created_at");
CREATE INDEX "credit_ledger_entries_reference_type_reference_id_idx"
  ON "credit_ledger_entries"("reference_type", "reference_id");

ALTER TABLE "credit_accounts"
  ADD CONSTRAINT "credit_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_lots"
  ADD CONSTRAINT "credit_lots_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "credit_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_reservations"
  ADD CONSTRAINT "credit_reservations_account_id_user_id_fkey"
  FOREIGN KEY ("account_id", "user_id") REFERENCES "credit_accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_reservation_allocations"
  ADD CONSTRAINT "credit_reservation_allocations_reservation_id_account_id_fkey"
  FOREIGN KEY ("reservation_id", "account_id") REFERENCES "credit_reservations"("id", "account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_reservation_allocations"
  ADD CONSTRAINT "credit_reservation_allocations_lot_id_account_id_fkey"
  FOREIGN KEY ("lot_id", "account_id") REFERENCES "credit_lots"("id", "account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_account_id_user_id_fkey"
  FOREIGN KEY ("account_id", "user_id") REFERENCES "credit_accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_lot_id_account_id_fkey"
  FOREIGN KEY ("lot_id", "account_id") REFERENCES "credit_lots"("id", "account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_reservation_id_account_id_fkey"
  FOREIGN KEY ("reservation_id", "account_id") REFERENCES "credit_reservations"("id", "account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_credit_ledger_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit ledger entries are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "credit_ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "credit_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION "prevent_credit_ledger_mutation"();
