-- AlterTable
ALTER TABLE "resources" ADD COLUMN "key" TEXT;

-- AlterTable
ALTER TABLE "concept_assessments" ADD COLUMN "title" TEXT,
ADD COLUMN "question_count" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_lesson_id_position_key" ON "content_blocks"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "resources_lesson_id_key_key" ON "resources"("lesson_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_lesson_id_position_key" ON "tasks"("lesson_id", "position");
