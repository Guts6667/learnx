-- CreateEnum
CREATE TYPE "program_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "content_block_type" AS ENUM ('rich_text', 'objective', 'definition', 'example', 'callout', 'quote', 'embed', 'divider');

-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('book', 'book_chapter', 'article', 'video', 'course', 'podcast', 'website', 'document', 'tool');

-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('reading', 'watching', 'listening', 'reflection', 'checklist', 'writing', 'practice', 'project');

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "program_status" NOT NULL DEFAULT 'draft',
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "estimated_duration_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "estimated_minutes" INTEGER,
    "estimated_duration_days" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "estimated_minutes" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives_json" JSONB NOT NULL,
    "prerequisites_json" JSONB NOT NULL,
    "estimated_minutes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "type" "content_block_type" NOT NULL,
    "content_json" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "type" "resource_type" NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "citation" TEXT,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "estimated_minutes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "task_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programs_owner_id_position_idx" ON "programs"("owner_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "programs_owner_id_slug_key" ON "programs"("owner_id", "slug");

-- CreateIndex
CREATE INDEX "stages_program_id_position_idx" ON "stages"("program_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "stages_program_id_slug_key" ON "stages"("program_id", "slug");

-- CreateIndex
CREATE INDEX "modules_stage_id_position_idx" ON "modules"("stage_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "modules_stage_id_slug_key" ON "modules"("stage_id", "slug");

-- CreateIndex
CREATE INDEX "lessons_module_id_position_idx" ON "lessons"("module_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_module_id_slug_key" ON "lessons"("module_id", "slug");

-- CreateIndex
CREATE INDEX "content_blocks_lesson_id_position_idx" ON "content_blocks"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "resources_lesson_id_position_idx" ON "resources"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "tasks_lesson_id_position_idx" ON "tasks"("lesson_id", "position");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
