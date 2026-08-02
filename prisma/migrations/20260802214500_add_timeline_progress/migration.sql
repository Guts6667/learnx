-- CreateEnum
CREATE TYPE "stage_progress_status" AS ENUM ('locked', 'available', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "program_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "target_end_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "status" "stage_progress_status" NOT NULL DEFAULT 'available',
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "target_end_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),

    CONSTRAINT "stage_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_progress_user_id_last_viewed_at_idx" ON "program_progress"("user_id", "last_viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "program_progress_user_id_program_id_key" ON "program_progress"("user_id", "program_id");

-- CreateIndex
CREATE INDEX "stage_progress_user_id_status_idx" ON "stage_progress"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stage_progress_user_id_stage_id_key" ON "stage_progress"("user_id", "stage_id");

-- AddForeignKey
ALTER TABLE "program_progress" ADD CONSTRAINT "program_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_progress" ADD CONSTRAINT "program_progress_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
