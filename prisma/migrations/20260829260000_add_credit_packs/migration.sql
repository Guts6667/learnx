-- V4.5-161 — purchasable credit packs.
--
-- Additive: one table. Every pack is created inactive and no pack is seeded
-- here: activating one is an owner decision (V4.5-164/012), and a migration
-- that inserted a sellable price would be taking that decision by writing it.
--
-- ROLLBACK
-- ========
-- Code-only revert needs nothing; the table is unread.
--
--   BEGIN;
--   DROP TABLE IF EXISTS "credit_packs";
--   COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS "credit_packs" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "credits" BIGINT NOT NULL,
  "price_minor" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_packs_key_key" ON "credit_packs"("key");
CREATE INDEX IF NOT EXISTS "credit_packs_active_position_idx"
ON "credit_packs"("active", "position");

COMMIT;
