-- V3-017: stable activity identities and an authoritative inter-type sequence.
-- This migration intentionally reproduces the V2 order and does not sequence resources.

CREATE TYPE "LessonSequenceKind" AS ENUM (
  'CONTENT',
  'RESOURCE',
  'TASK',
  'CONCEPT_ASSESSMENT',
  'EXERCISE',
  'QUIZ'
);

ALTER TABLE "content_blocks" ADD COLUMN "key" TEXT;
ALTER TABLE "concept_assessments"
  ADD COLUMN "lesson_id" UUID,
  ADD COLUMN "key" TEXT;
ALTER TABLE "quizzes" ADD COLUMN "key" TEXT;

UPDATE "content_blocks"
SET "key" = 'content-' || "position"::TEXT;

UPDATE "resources"
SET "key" = 'resource-' || "position"::TEXT
WHERE "key" IS NULL;

UPDATE "concept_assessments" AS assessment
SET
  "lesson_id" = concept."lesson_id",
  "key" = 'concept-' || concept."slug" || '-assessment-' || assessment."position"::TEXT
FROM "concepts" AS concept
WHERE concept."id" = assessment."concept_id";

UPDATE "quizzes"
SET "key" = 'quiz-' || "position"::TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "content_blocks"
    GROUP BY "lesson_id", "position" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'V3-017 blocked: duplicate content positions make the V2 order ambiguous';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "tasks" WHERE "is_canonical" = TRUE
    GROUP BY "lesson_id", "position" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'V3-017 blocked: duplicate canonical task positions make the V2 order ambiguous';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "concepts"
    GROUP BY "lesson_id", "position" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'V3-017 blocked: duplicate concept positions make the V2 order ambiguous';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "concept_assessments"
    GROUP BY "concept_id", "position"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'V3-017 blocked: duplicate concept assessment positions make the V2 order ambiguous';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "exercises" WHERE "is_canonical" = TRUE
    GROUP BY "lesson_id", "position" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'V3-017 blocked: duplicate canonical exercise positions make the V2 order ambiguous';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "quizzes"
    GROUP BY "lesson_id", "position" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'V3-017 blocked: duplicate quiz positions make the V2 order ambiguous';
  END IF;
END $$;

ALTER TABLE "content_blocks" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "resources" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "concept_assessments" ALTER COLUMN "lesson_id" SET NOT NULL;
ALTER TABLE "concept_assessments" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "quizzes" ALTER COLUMN "key" SET NOT NULL;

CREATE UNIQUE INDEX "content_blocks_lesson_id_key_key" ON "content_blocks"("lesson_id", "key");
CREATE UNIQUE INDEX "content_blocks_lesson_id_id_key" ON "content_blocks"("lesson_id", "id");
CREATE UNIQUE INDEX "concepts_lesson_id_id_key" ON "concepts"("lesson_id", "id");
CREATE UNIQUE INDEX "resources_lesson_id_id_key" ON "resources"("lesson_id", "id");
CREATE UNIQUE INDEX "tasks_lesson_id_id_key" ON "tasks"("lesson_id", "id");
CREATE UNIQUE INDEX "concept_assessments_lesson_id_key_key" ON "concept_assessments"("lesson_id", "key");
CREATE UNIQUE INDEX "concept_assessments_lesson_id_id_key" ON "concept_assessments"("lesson_id", "id");
CREATE UNIQUE INDEX "exercises_lesson_id_id_key" ON "exercises"("lesson_id", "id");
CREATE UNIQUE INDEX "quizzes_lesson_id_key_key" ON "quizzes"("lesson_id", "key");
CREATE UNIQUE INDEX "quizzes_lesson_id_id_key" ON "quizzes"("lesson_id", "id");

ALTER TABLE "concept_assessments"
  ADD CONSTRAINT "concept_assessments_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concept_assessments" DROP CONSTRAINT "concept_assessments_concept_id_fkey";
ALTER TABLE "concept_assessments"
  ADD CONSTRAINT "concept_assessments_lesson_id_concept_id_fkey"
  FOREIGN KEY ("lesson_id", "concept_id") REFERENCES "concepts"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lesson_sequence_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lesson_id" UUID NOT NULL,
  "kind" "LessonSequenceKind" NOT NULL,
  "key" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "content_block_id" UUID,
  "resource_id" UUID,
  "task_id" UUID,
  "concept_assessment_id" UUID,
  "exercise_id" UUID,
  "quiz_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "backfilled_from_v2" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "lesson_sequence_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_sequence_items_target_check" CHECK (
    ("kind" = 'CONTENT' AND "content_block_id" IS NOT NULL AND "resource_id" IS NULL AND "task_id" IS NULL AND "concept_assessment_id" IS NULL AND "exercise_id" IS NULL AND "quiz_id" IS NULL)
    OR ("kind" = 'RESOURCE' AND "content_block_id" IS NULL AND "resource_id" IS NOT NULL AND "task_id" IS NULL AND "concept_assessment_id" IS NULL AND "exercise_id" IS NULL AND "quiz_id" IS NULL)
    OR ("kind" = 'TASK' AND "content_block_id" IS NULL AND "resource_id" IS NULL AND "task_id" IS NOT NULL AND "concept_assessment_id" IS NULL AND "exercise_id" IS NULL AND "quiz_id" IS NULL)
    OR ("kind" = 'CONCEPT_ASSESSMENT' AND "content_block_id" IS NULL AND "resource_id" IS NULL AND "task_id" IS NULL AND "concept_assessment_id" IS NOT NULL AND "exercise_id" IS NULL AND "quiz_id" IS NULL)
    OR ("kind" = 'EXERCISE' AND "content_block_id" IS NULL AND "resource_id" IS NULL AND "task_id" IS NULL AND "concept_assessment_id" IS NULL AND "exercise_id" IS NOT NULL AND "quiz_id" IS NULL)
    OR ("kind" = 'QUIZ' AND "content_block_id" IS NULL AND "resource_id" IS NULL AND "task_id" IS NULL AND "concept_assessment_id" IS NULL AND "exercise_id" IS NULL AND "quiz_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_position_key" ON "lesson_sequence_items"("lesson_id", "position");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_kind_key_key" ON "lesson_sequence_items"("lesson_id", "kind", "key");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_id_key" ON "lesson_sequence_items"("lesson_id", "id");
CREATE UNIQUE INDEX "lesson_sequence_items_content_block_id_key" ON "lesson_sequence_items"("content_block_id");
CREATE UNIQUE INDEX "lesson_sequence_items_resource_id_key" ON "lesson_sequence_items"("resource_id");
CREATE UNIQUE INDEX "lesson_sequence_items_task_id_key" ON "lesson_sequence_items"("task_id");
CREATE UNIQUE INDEX "lesson_sequence_items_concept_assessment_id_key" ON "lesson_sequence_items"("concept_assessment_id");
CREATE UNIQUE INDEX "lesson_sequence_items_exercise_id_key" ON "lesson_sequence_items"("exercise_id");
CREATE UNIQUE INDEX "lesson_sequence_items_quiz_id_key" ON "lesson_sequence_items"("quiz_id");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_content_block_id_key" ON "lesson_sequence_items"("lesson_id", "content_block_id");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_resource_id_key" ON "lesson_sequence_items"("lesson_id", "resource_id");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_task_id_key" ON "lesson_sequence_items"("lesson_id", "task_id");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_concept_assessment_id_key" ON "lesson_sequence_items"("lesson_id", "concept_assessment_id");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_exercise_id_key" ON "lesson_sequence_items"("lesson_id", "exercise_id");
CREATE UNIQUE INDEX "lesson_sequence_items_lesson_id_quiz_id_key" ON "lesson_sequence_items"("lesson_id", "quiz_id");

ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_content_block_fkey" FOREIGN KEY ("lesson_id", "content_block_id") REFERENCES "content_blocks"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_resource_fkey" FOREIGN KEY ("lesson_id", "resource_id") REFERENCES "resources"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_task_fkey" FOREIGN KEY ("lesson_id", "task_id") REFERENCES "tasks"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_concept_assessment_fkey" FOREIGN KEY ("lesson_id", "concept_assessment_id") REFERENCES "concept_assessments"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_exercise_fkey" FOREIGN KEY ("lesson_id", "exercise_id") REFERENCES "exercises"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_sequence_items" ADD CONSTRAINT "lesson_sequence_items_quiz_fkey" FOREIGN KEY ("lesson_id", "quiz_id") REFERENCES "quizzes"("lesson_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH v2_activities AS (
  SELECT "lesson_id", 'CONTENT'::"LessonSequenceKind" AS kind, "key", "id" AS target_id, 1 AS family_order, "position" AS primary_order, "id" AS secondary_order, 0 AS tertiary_order, "id" AS final_order
  FROM "content_blocks"
  UNION ALL
  SELECT "lesson_id", 'TASK'::"LessonSequenceKind", "key", "id", 2, "position", "id", 0, "id"
  FROM "tasks" WHERE "is_canonical" = TRUE
  UNION ALL
  SELECT concept."lesson_id", 'CONCEPT_ASSESSMENT'::"LessonSequenceKind", assessment."key", assessment."id", 3, concept."position", concept."id", assessment."position", assessment."id"
  FROM "concept_assessments" assessment
  JOIN "concepts" concept ON concept."id" = assessment."concept_id"
  UNION ALL
  SELECT "lesson_id", 'EXERCISE'::"LessonSequenceKind", "key", "id", 4, "position", "id", 0, "id"
  FROM "exercises" WHERE "is_canonical" = TRUE
  UNION ALL
  SELECT "lesson_id", 'QUIZ'::"LessonSequenceKind", "key", "id", 5, "position", "id", 0, "id"
  FROM "quizzes"
), ordered AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY "lesson_id"
    ORDER BY family_order, primary_order, secondary_order, tertiary_order, final_order
  )::INTEGER AS sequence_position
  FROM v2_activities
)
INSERT INTO "lesson_sequence_items" (
  "lesson_id", "kind", "key", "position", "content_block_id", "task_id",
  "concept_assessment_id", "exercise_id", "quiz_id", "backfilled_from_v2"
)
SELECT
  "lesson_id", kind, "key", sequence_position,
  CASE WHEN kind = 'CONTENT' THEN target_id END,
  CASE WHEN kind = 'TASK' THEN target_id END,
  CASE WHEN kind = 'CONCEPT_ASSESSMENT' THEN target_id END,
  CASE WHEN kind = 'EXERCISE' THEN target_id END,
  CASE WHEN kind = 'QUIZ' THEN target_id END,
  TRUE
FROM ordered;

ALTER TABLE "lesson_progress" ADD COLUMN "current_sequence_item_id" UUID;
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_current_sequence_item_fkey"
  FOREIGN KEY ("lesson_id", "current_sequence_item_id")
  REFERENCES "lesson_sequence_items"("lesson_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_lesson_activity_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."key" IS DISTINCT FROM OLD."key" THEN
    RAISE EXCEPTION 'Lesson activity keys are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "content_blocks_key_immutable" BEFORE UPDATE ON "content_blocks" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_activity_identity_change();
CREATE TRIGGER "resources_key_immutable" BEFORE UPDATE ON "resources" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_activity_identity_change();
CREATE TRIGGER "tasks_key_immutable" BEFORE UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_activity_identity_change();
CREATE TRIGGER "concept_assessments_key_immutable" BEFORE UPDATE ON "concept_assessments" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_activity_identity_change();
CREATE TRIGGER "exercises_key_immutable" BEFORE UPDATE ON "exercises" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_activity_identity_change();
CREATE TRIGGER "quizzes_key_immutable" BEFORE UPDATE ON "quizzes" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_activity_identity_change();

CREATE OR REPLACE FUNCTION prevent_lesson_sequence_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."lesson_id" IS DISTINCT FROM OLD."lesson_id"
    OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."key" IS DISTINCT FROM OLD."key"
    OR NEW."content_block_id" IS DISTINCT FROM OLD."content_block_id"
    OR NEW."resource_id" IS DISTINCT FROM OLD."resource_id"
    OR NEW."task_id" IS DISTINCT FROM OLD."task_id"
    OR NEW."concept_assessment_id" IS DISTINCT FROM OLD."concept_assessment_id"
    OR NEW."exercise_id" IS DISTINCT FROM OLD."exercise_id"
    OR NEW."quiz_id" IS DISTINCT FROM OLD."quiz_id"
  THEN
    RAISE EXCEPTION 'Lesson sequence identities and targets are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "lesson_sequence_identity_immutable" BEFORE UPDATE ON "lesson_sequence_items" FOR EACH ROW EXECUTE FUNCTION prevent_lesson_sequence_identity_change();
