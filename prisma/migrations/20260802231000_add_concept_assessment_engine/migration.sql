-- CreateEnum
CREATE TYPE "concept_question_type" AS ENUM ('true_false', 'single_choice', 'multiple_choice', 'short_answer');

-- CreateEnum
CREATE TYPE "review_source_type" AS ENUM ('concept_assessment');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('pending', 'completed');

-- CreateTable
CREATE TABLE "concept_assessment_questions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "type" "concept_question_type" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "accepted_answers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "concept_assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_assessment_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "concept_assessment_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_assessment_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "answers_json" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "source_type" "review_source_type" NOT NULL,
    "source_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "status" "review_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concept_assessment_questions_assessment_id_position_key" ON "concept_assessment_questions"("assessment_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "concept_assessment_options_question_id_position_key" ON "concept_assessment_options"("question_id", "position");

-- CreateIndex
CREATE INDEX "concept_assessment_attempts_user_id_assessment_id_submitted_at_idx" ON "concept_assessment_attempts"("user_id", "assessment_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_items_user_id_source_type_source_id_key" ON "review_items"("user_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "review_items_user_id_due_at_status_idx" ON "review_items"("user_id", "due_at", "status");

-- AddForeignKey
ALTER TABLE "concept_assessment_questions" ADD CONSTRAINT "concept_assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "concept_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_assessment_options" ADD CONSTRAINT "concept_assessment_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "concept_assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_assessment_attempts" ADD CONSTRAINT "concept_assessment_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_assessment_attempts" ADD CONSTRAINT "concept_assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "concept_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
