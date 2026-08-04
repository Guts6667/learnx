-- CreateTable
CREATE TABLE "module_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restart_key" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN "module_run_id" UUID;
ALTER TABLE "concept_assessment_attempts" ADD COLUMN "module_run_id" UUID;
ALTER TABLE "exercise_submissions" ADD COLUMN "module_run_id" UUID;

-- Backfill one initial run for every module with existing user activity.
WITH "active_modules" AS (
    SELECT "lp"."user_id", "l"."module_id" FROM "lesson_progress" "lp"
    JOIN "lessons" "l" ON "l"."id" = "lp"."lesson_id"
    UNION
    SELECT "tc"."user_id", "l"."module_id" FROM "task_completions" "tc"
    JOIN "tasks" "t" ON "t"."id" = "tc"."task_id"
    JOIN "lessons" "l" ON "l"."id" = "t"."lesson_id"
    UNION
    SELECT "rp"."user_id", "l"."module_id" FROM "resource_progress" "rp"
    JOIN "resources" "r" ON "r"."id" = "rp"."resource_id"
    JOIN "lessons" "l" ON "l"."id" = "r"."lesson_id"
    UNION
    SELECT "cp"."user_id", "l"."module_id" FROM "concept_progress" "cp"
    JOIN "concepts" "c" ON "c"."id" = "cp"."concept_id"
    JOIN "lessons" "l" ON "l"."id" = "c"."lesson_id"
    UNION
    SELECT "qa"."user_id", "l"."module_id" FROM "quiz_attempts" "qa"
    JOIN "quizzes" "q" ON "q"."id" = "qa"."quiz_id"
    JOIN "lessons" "l" ON "l"."id" = "q"."lesson_id"
    UNION
    SELECT "caa"."user_id", "l"."module_id" FROM "concept_assessment_attempts" "caa"
    JOIN "concept_assessments" "ca" ON "ca"."id" = "caa"."assessment_id"
    JOIN "concepts" "c" ON "c"."id" = "ca"."concept_id"
    JOIN "lessons" "l" ON "l"."id" = "c"."lesson_id"
    UNION
    SELECT "es"."user_id", "l"."module_id" FROM "exercise_submissions" "es"
    JOIN "exercises" "e" ON "e"."id" = "es"."exercise_id"
    JOIN "lessons" "l" ON "l"."id" = "e"."lesson_id"
)
INSERT INTO "module_runs" ("id", "user_id", "module_id", "sequence", "started_at", "created_at")
SELECT gen_random_uuid(), "user_id", "module_id", 1, TIMESTAMP '1970-01-01 00:00:00', CURRENT_TIMESTAMP
FROM "active_modules";

-- Attach all append-only history to the initial run.
UPDATE "quiz_attempts" "qa"
SET "module_run_id" = "mr"."id"
FROM "quizzes" "q", "lessons" "l", "module_runs" "mr"
WHERE "q"."id" = "qa"."quiz_id"
  AND "l"."id" = "q"."lesson_id"
  AND "mr"."user_id" = "qa"."user_id"
  AND "mr"."module_id" = "l"."module_id"
  AND "mr"."sequence" = 1;

UPDATE "concept_assessment_attempts" "caa"
SET "module_run_id" = "mr"."id"
FROM "concept_assessments" "ca", "concepts" "c", "lessons" "l", "module_runs" "mr"
WHERE "ca"."id" = "caa"."assessment_id"
  AND "c"."id" = "ca"."concept_id"
  AND "l"."id" = "c"."lesson_id"
  AND "mr"."user_id" = "caa"."user_id"
  AND "mr"."module_id" = "l"."module_id"
  AND "mr"."sequence" = 1;

UPDATE "exercise_submissions" "es"
SET "module_run_id" = "mr"."id"
FROM "exercises" "e", "lessons" "l", "module_runs" "mr"
WHERE "e"."id" = "es"."exercise_id"
  AND "l"."id" = "e"."lesson_id"
  AND "mr"."user_id" = "es"."user_id"
  AND "mr"."module_id" = "l"."module_id"
  AND "mr"."sequence" = 1;

ALTER TABLE "quiz_attempts" ALTER COLUMN "module_run_id" SET NOT NULL;
ALTER TABLE "concept_assessment_attempts" ALTER COLUMN "module_run_id" SET NOT NULL;
ALTER TABLE "exercise_submissions" ALTER COLUMN "module_run_id" SET NOT NULL;

-- Replace legacy uniqueness/indexes with run-aware equivalents.
DROP INDEX "quiz_attempts_user_quiz_submitted_idx";
DROP INDEX "concept_assessment_attempts_user_assessment_submitted_idx";
DROP INDEX "exercise_submissions_user_id_exercise_id_key";

CREATE UNIQUE INDEX "module_runs_user_id_module_id_sequence_key" ON "module_runs"("user_id", "module_id", "sequence");
CREATE UNIQUE INDEX "module_runs_user_id_module_id_restart_key_key" ON "module_runs"("user_id", "module_id", "restart_key");
CREATE INDEX "module_runs_user_id_module_id_started_at_idx" ON "module_runs"("user_id", "module_id", "started_at");
CREATE INDEX "quiz_attempts_user_quiz_run_submitted_idx" ON "quiz_attempts"("user_id", "quiz_id", "module_run_id", "submitted_at");
CREATE INDEX "concept_assessment_attempts_user_assessment_run_submitted_idx" ON "concept_assessment_attempts"("user_id", "assessment_id", "module_run_id", "submitted_at");
CREATE UNIQUE INDEX "exercise_submissions_user_id_exercise_id_module_run_id_key" ON "exercise_submissions"("user_id", "exercise_id", "module_run_id");

-- AddForeignKey
ALTER TABLE "module_runs" ADD CONSTRAINT "module_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_runs" ADD CONSTRAINT "module_runs_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_module_run_id_fkey" FOREIGN KEY ("module_run_id") REFERENCES "module_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concept_assessment_attempts" ADD CONSTRAINT "concept_assessment_attempts_module_run_id_fkey" FOREIGN KEY ("module_run_id") REFERENCES "module_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_module_run_id_fkey" FOREIGN KEY ("module_run_id") REFERENCES "module_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
