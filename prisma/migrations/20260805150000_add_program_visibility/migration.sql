CREATE TYPE "program_visibility" AS ENUM ('private', 'public');

ALTER TYPE "audit_action" ADD VALUE 'program_visibility_update';

ALTER TABLE "programs"
ADD COLUMN "visibility" "program_visibility" NOT NULL DEFAULT 'private';

CREATE INDEX "programs_visibility_status_position_idx"
ON "programs"("visibility", "status", "position");
