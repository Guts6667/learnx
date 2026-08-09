ALTER TABLE "programs"
ADD COLUMN "canonical_program_key" TEXT,
ADD COLUMN "locale" VARCHAR(2) NOT NULL DEFAULT 'fr';

ALTER TABLE "stages" ADD COLUMN "canonical_key" TEXT;
ALTER TABLE "modules" ADD COLUMN "canonical_key" TEXT;
ALTER TABLE "lessons" ADD COLUMN "canonical_key" TEXT;

UPDATE "programs"
SET "canonical_program_key" = "slug"
WHERE "canonical_program_key" IS NULL;

UPDATE "stages" SET "canonical_key" = "slug" WHERE "canonical_key" IS NULL;
UPDATE "modules" SET "canonical_key" = "slug" WHERE "canonical_key" IS NULL;
UPDATE "lessons" SET "canonical_key" = "slug" WHERE "canonical_key" IS NULL;

ALTER TABLE "programs"
ALTER COLUMN "canonical_program_key" SET NOT NULL,
ADD CONSTRAINT "programs_locale_check" CHECK ("locale" IN ('fr', 'en'));
ALTER TABLE "stages" ALTER COLUMN "canonical_key" SET NOT NULL;
ALTER TABLE "modules" ALTER COLUMN "canonical_key" SET NOT NULL;
ALTER TABLE "lessons" ALTER COLUMN "canonical_key" SET NOT NULL;

CREATE UNIQUE INDEX "programs_owner_id_canonical_program_key_locale_key"
ON "programs"("owner_id", "canonical_program_key", "locale");
CREATE INDEX "programs_locale_visibility_status_position_idx"
ON "programs"("locale", "visibility", "status", "position");
CREATE UNIQUE INDEX "stages_program_id_canonical_key_key"
ON "stages"("program_id", "canonical_key");
CREATE UNIQUE INDEX "modules_stage_id_canonical_key_key"
ON "modules"("stage_id", "canonical_key");
CREATE UNIQUE INDEX "lessons_module_id_canonical_key_key"
ON "lessons"("module_id", "canonical_key");
