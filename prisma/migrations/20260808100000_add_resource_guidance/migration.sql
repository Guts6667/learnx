ALTER TABLE "resources"
ADD COLUMN "guidance_json" JSONB;

COMMENT ON COLUMN "resources"."guidance_json" IS
  'Author-provided learner guidance; editorial evidence remains outside the database.';
