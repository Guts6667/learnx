-- CreateEnum
CREATE TYPE "exercise_submission_status" AS ENUM ('draft', 'submitted');

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "rubric_json" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "content_markdown" TEXT NOT NULL DEFAULT '',
    "status" "exercise_submission_status" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_lesson_id_position_key" ON "exercises"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "exercises_lesson_id_position_idx" ON "exercises"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_submissions_user_id_exercise_id_key" ON "exercise_submissions"("user_id", "exercise_id");

-- CreateIndex
CREATE INDEX "exercise_submissions_exercise_id_status_idx" ON "exercise_submissions"("exercise_id", "status");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
