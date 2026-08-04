-- CreateEnum
CREATE TYPE "canonical_activity_kind" AS ENUM ('task', 'exercise');

-- AlterTable: stable editorial identity and archival marker for legacy mirrors.
ALTER TABLE "tasks"
  ADD COLUMN "key" TEXT,
  ADD COLUMN "is_canonical" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "exercises"
  ADD COLUMN "key" TEXT,
  ADD COLUMN "activity_type" "task_type",
  ADD COLUMN "is_canonical" BOOLEAN NOT NULL DEFAULT true;

UPDATE "tasks"
SET "key" = 'activity-' || "position"::TEXT;

UPDATE "exercises" "exercise"
SET
  "key" = 'activity-' || "exercise"."position"::TEXT,
  "activity_type" = COALESCE(
    (
      SELECT "task"."type"
      FROM "tasks" "task"
      WHERE "task"."lesson_id" = "exercise"."lesson_id"
        AND "task"."position" = "exercise"."position"
      LIMIT 1
    ),
    'practice'::"task_type"
  );

ALTER TABLE "tasks" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "exercises" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "exercises" ALTER COLUMN "activity_type" SET NOT NULL;

-- CreateTable: explicit support links for passive tasks.
CREATE TABLE "task_resources" (
  "task_id" UUID NOT NULL,
  "resource_id" UUID NOT NULL,
  CONSTRAINT "task_resources_pkey" PRIMARY KEY ("task_id", "resource_id")
);

-- CreateTable: preserves inherited completion without manufacturing attempts.
CREATE TABLE "activity_completion_carryovers" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "activity_key" TEXT NOT NULL,
  "kind" "canonical_activity_kind" NOT NULL,
  "module_run_id" UUID NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL,
  "sources_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_completion_carryovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_lesson_id_key_key" ON "tasks"("lesson_id", "key");
CREATE UNIQUE INDEX "exercises_lesson_id_key_key" ON "exercises"("lesson_id", "key");
CREATE INDEX "task_resources_resource_id_idx" ON "task_resources"("resource_id");
CREATE UNIQUE INDEX "activity_completion_carryovers_user_lesson_key_kind_run_key"
  ON "activity_completion_carryovers"("user_id", "lesson_id", "activity_key", "kind", "module_run_id");
CREATE INDEX "activity_completion_carryovers_lesson_key_kind_idx"
  ON "activity_completion_carryovers"("lesson_id", "activity_key", "kind");

-- AddForeignKey
ALTER TABLE "task_resources" ADD CONSTRAINT "task_resources_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_resources" ADD CONSTRAINT "task_resources_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_completion_carryovers" ADD CONSTRAINT "activity_completion_carryovers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_completion_carryovers" ADD CONSTRAINT "activity_completion_carryovers_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_completion_carryovers" ADD CONSTRAINT "activity_completion_carryovers_module_run_id_fkey"
  FOREIGN KEY ("module_run_id") REFERENCES "module_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
