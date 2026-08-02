-- CreateEnum
CREATE TYPE "lesson_progress_status" AS ENUM ('available', 'in_progress', 'completed', 'needs_review');

-- CreateEnum
CREATE TYPE "task_completion_status" AS ENUM ('todo', 'done', 'skipped');

-- CreateEnum
CREATE TYPE "resource_progress_status" AS ENUM ('not_started', 'started', 'completed');

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "lesson_progress_status" NOT NULL DEFAULT 'available',
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "status" "task_completion_status" NOT NULL DEFAULT 'todo',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "status" "resource_progress_status" NOT NULL DEFAULT 'not_started',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "resource_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_status_idx" ON "lesson_progress"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_key" ON "lesson_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "task_completions_user_id_status_idx" ON "task_completions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_user_id_task_id_key" ON "task_completions"("user_id", "task_id");

-- CreateIndex
CREATE INDEX "resource_progress_user_id_status_idx" ON "resource_progress"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "resource_progress_user_id_resource_id_key" ON "resource_progress"("user_id", "resource_id");

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_progress" ADD CONSTRAINT "resource_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_progress" ADD CONSTRAINT "resource_progress_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
