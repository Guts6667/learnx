-- V4.5-160 — payment orders and webhook events (ADR_004).
--
-- Additive: two enums, two tables. Nothing existing is altered, and
-- LEARNX_PAYMENTS_ENABLED is false by default, so this ships inert.
--
-- No column here can hold card data, and none should ever be added that could:
-- the checkout is hosted by Revolut and LearnX never sees the instrument
-- (ADR_004 §1, §7). `payload_json` holds the event body as received, stored
-- only after its signature verified.
--
-- Guards qualified by the current schema, per docs/TESTING_AND_RELEASE.md.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing; the tables are simply unread.
--
--   BEGIN;
--   DROP TABLE IF EXISTS "payment_events";
--   DROP TABLE IF EXISTS "payment_orders";
--   DROP TYPE IF EXISTS "payment_event_outcome";
--   DROP TYPE IF EXISTS "payment_order_status";
--   COMMIT;
--
-- That destroys the record of what a provider sent us, which is the only thing
-- reconciliation can read against their side. Deliberately not automated.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payment_order_status' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "payment_order_status" AS ENUM (
      'created', 'pending', 'paid', 'fulfilled', 'failed', 'expired',
      'refund_pending', 'refunded', 'disputed', 'dispute_won', 'dispute_lost'
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payment_event_outcome' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "payment_event_outcome" AS ENUM (
      'applied', 'duplicate', 'out_of_order', 'disabled'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider_order_id" TEXT NOT NULL,
  "status" "payment_order_status" NOT NULL DEFAULT 'created',
  "amount_minor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "pack_key" TEXT NOT NULL,
  "fulfilled_at" TIMESTAMP(3),
  "credit_lot_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_provider_order_id_key"
ON "payment_orders"("provider_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_credit_lot_id_key"
ON "payment_orders"("credit_lot_id");
CREATE INDEX IF NOT EXISTS "payment_orders_user_id_created_at_idx"
ON "payment_orders"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "payment_orders_status_updated_at_idx"
ON "payment_orders"("status", "updated_at");

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" UUID NOT NULL,
  "order_id" UUID,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "outcome" "payment_event_outcome" NOT NULL,
  "payload_json" JSONB NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- The uniqueness that makes a replayed delivery harmless (ADR_004 §3).
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_event_id_key"
ON "payment_events"("provider_event_id");
CREATE INDEX IF NOT EXISTS "payment_events_order_id_received_at_idx"
ON "payment_events"("order_id", "received_at");
CREATE INDEX IF NOT EXISTS "payment_events_received_at_idx"
ON "payment_events"("received_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_orders_user_id_fkey'
      AND conrelid = 'payment_orders'::regclass
  ) THEN
    ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_events_order_id_fkey'
      AND conrelid = 'payment_events'::regclass
  ) THEN
    ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "payment_orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
