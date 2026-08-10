CREATE TYPE "PublicLeadPurpose" AS ENUM ('LAUNCH_UPDATES', 'EARLY_ADOPTER');
CREATE TYPE "PublicLeadStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'UNSUBSCRIBED', 'DELETED');

CREATE TABLE "public_leads" (
  "id" UUID NOT NULL,
  "email_normalized" TEXT NOT NULL,
  "purpose" "PublicLeadPurpose" NOT NULL,
  "status" "PublicLeadStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "locale" VARCHAR(2) NOT NULL DEFAULT 'fr',
  "motivation" TEXT,
  "consent_version" VARCHAR(32) NOT NULL,
  "confirmation_token_hash" TEXT,
  "confirmation_expires_at" TIMESTAMP(3),
  "management_token_hash" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "unsubscribed_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "converted_access_request_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_leads_confirmation_token_hash_key" ON "public_leads"("confirmation_token_hash");
CREATE UNIQUE INDEX "public_leads_management_token_hash_key" ON "public_leads"("management_token_hash");
CREATE UNIQUE INDEX "public_leads_email_normalized_purpose_key" ON "public_leads"("email_normalized", "purpose");
CREATE UNIQUE INDEX "public_leads_converted_access_request_id_key" ON "public_leads"("converted_access_request_id");
CREATE INDEX "public_leads_purpose_status_created_at_idx" ON "public_leads"("purpose", "status", "created_at");
ALTER TABLE "public_leads" ADD CONSTRAINT "public_leads_converted_access_request_id_fkey" FOREIGN KEY ("converted_access_request_id") REFERENCES "access_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
