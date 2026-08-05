CREATE TYPE "program_enrollment_status" AS ENUM ('active', 'withdrawn');

CREATE UNIQUE INDEX "program_versions_program_id_id_key"
ON "program_versions"("program_id", "id");

CREATE TABLE "program_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "program_version_id" UUID NOT NULL,
  "status" "program_enrollment_status" NOT NULL DEFAULT 'active',
  "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "program_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "program_enrollments_status_consistency_check" CHECK (
    ("status" = 'active' AND "withdrawn_at" IS NULL)
    OR ("status" = 'withdrawn' AND "withdrawn_at" IS NOT NULL)
  ),
  CONSTRAINT "program_enrollments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_enrollments_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "programs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_enrollments_program_version_id_fkey"
    FOREIGN KEY ("program_version_id") REFERENCES "program_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_enrollments_program_version_fkey"
    FOREIGN KEY ("program_id", "program_version_id")
    REFERENCES "program_versions"("program_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "program_enrollments_user_id_program_id_key"
ON "program_enrollments"("user_id", "program_id");
CREATE INDEX "program_enrollments_user_id_status_updated_at_idx"
ON "program_enrollments"("user_id", "status", "updated_at");
CREATE INDEX "program_enrollments_program_id_status_idx"
ON "program_enrollments"("program_id", "status");
CREATE INDEX "program_enrollments_program_version_id_idx"
ON "program_enrollments"("program_version_id");

WITH legacy_access AS (
  SELECT p."owner_id" AS user_id, p."id" AS program_id,
         p."published_version_id" AS program_version_id
  FROM "programs" p
  WHERE p."published_version_id" IS NOT NULL

  UNION

  SELECT pp."user_id", pp."program_id", p."published_version_id"
  FROM "program_progress" pp
  JOIN "programs" p ON p."id" = pp."program_id"
  WHERE p."published_version_id" IS NOT NULL
)
INSERT INTO "program_enrollments" (
  "user_id", "program_id", "program_version_id", "status"
)
SELECT user_id, program_id, program_version_id, 'active'
FROM legacy_access
ON CONFLICT ("user_id", "program_id") DO NOTHING;
