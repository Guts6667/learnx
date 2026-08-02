-- CreateEnum
CREATE TYPE "concept_assessment_type" AS ENUM ('quiz', 'short_answer', 'practice', 'flashcard', 'case_question');

-- CreateEnum
CREATE TYPE "concept_progress_status" AS ENUM ('not_started', 'learning', 'validated', 'needs_review');

-- CreateTable
CREATE TABLE "concepts" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "mastery_threshold" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_resources" (
    "id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,

    CONSTRAINT "concept_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_assessments" (
    "id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "assessment_type" "concept_assessment_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "concept_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "status" "concept_progress_status" NOT NULL DEFAULT 'not_started',
    "best_score" DOUBLE PRECISION,
    "validated_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),

    CONSTRAINT "concept_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concepts_lesson_id_position_idx" ON "concepts"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_lesson_id_slug_key" ON "concepts"("lesson_id", "slug");

-- CreateIndex
CREATE INDEX "concept_resources_resource_id_idx" ON "concept_resources"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "concept_resources_concept_id_resource_id_key" ON "concept_resources"("concept_id", "resource_id");

-- CreateIndex
CREATE INDEX "concept_assessments_concept_id_position_idx" ON "concept_assessments"("concept_id", "position");

-- CreateIndex
CREATE INDEX "concept_progress_user_id_status_idx" ON "concept_progress"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "concept_progress_user_id_concept_id_key" ON "concept_progress"("user_id", "concept_id");

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_resources" ADD CONSTRAINT "concept_resources_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_resources" ADD CONSTRAINT "concept_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_assessments" ADD CONSTRAINT "concept_assessments_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_progress" ADD CONSTRAINT "concept_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_progress" ADD CONSTRAINT "concept_progress_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
