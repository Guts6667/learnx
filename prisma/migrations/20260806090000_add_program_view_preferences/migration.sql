CREATE UNIQUE INDEX "stages_program_id_id_key"
ON "stages"("program_id", "id");

CREATE TABLE "program_view_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "expanded_stage_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "program_view_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "program_view_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_view_preferences_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "programs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_view_preferences_expanded_stage_fkey"
    FOREIGN KEY ("program_id", "expanded_stage_id")
    REFERENCES "stages"("program_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "program_view_preferences_user_id_program_id_key"
ON "program_view_preferences"("user_id", "program_id");

CREATE INDEX "program_view_preferences_program_id_expanded_stage_id_idx"
ON "program_view_preferences"("program_id", "expanded_stage_id");
