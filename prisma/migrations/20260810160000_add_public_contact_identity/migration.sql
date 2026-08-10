CREATE TABLE "public_contacts" (
  "id" UUID NOT NULL,
  "email_normalized" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_contacts_email_normalized_key"
  ON "public_contacts"("email_normalized");

INSERT INTO "public_contacts" (
  "id",
  "email_normalized",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  "email_normalized",
  MIN("created_at"),
  MAX("updated_at")
FROM "public_leads"
GROUP BY "email_normalized";

ALTER TABLE "public_leads" ADD COLUMN "contact_id" UUID;

UPDATE "public_leads" AS lead
SET "contact_id" = contact."id"
FROM "public_contacts" AS contact
WHERE contact."email_normalized" = lead."email_normalized";

ALTER TABLE "public_leads" ALTER COLUMN "contact_id" SET NOT NULL;
DROP INDEX "public_leads_email_normalized_purpose_key";
ALTER TABLE "public_leads" DROP COLUMN "email_normalized";

CREATE UNIQUE INDEX "public_leads_contact_id_purpose_key"
  ON "public_leads"("contact_id", "purpose");

ALTER TABLE "public_leads"
  ADD CONSTRAINT "public_leads_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "public_contacts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
