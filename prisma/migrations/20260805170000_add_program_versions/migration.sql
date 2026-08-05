CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "program_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "snapshot_json" JSONB NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_by_user_id" UUID NOT NULL,
  CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "program_versions_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "program_versions_checksum_sha256_check" CHECK ("checksum" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "program_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "program_versions_program_id_version_key"
ON "program_versions"("program_id", "version");
CREATE UNIQUE INDEX "program_versions_program_id_checksum_key"
ON "program_versions"("program_id", "checksum");
CREATE INDEX "program_versions_program_id_published_at_idx"
ON "program_versions"("program_id", "published_at");
CREATE INDEX "program_versions_published_by_user_id_published_at_idx"
ON "program_versions"("published_by_user_id", "published_at");

ALTER TABLE "programs" ADD COLUMN "published_version_id" UUID;
CREATE UNIQUE INDEX "programs_published_version_id_key"
ON "programs"("published_version_id");

WITH active_programs AS (
  SELECT p.* FROM "programs" p WHERE p."status" = 'active'
), snapshots AS (
  SELECT
    p."id" AS program_id,
    p."owner_id" AS owner_id,
    p."updated_at" AS published_at,
    jsonb_build_object(
      'schemaVersion', 0,
      'program', to_jsonb(p) - 'owner_id' - 'created_at' - 'updated_at' - 'published_version_id',
      'stages', COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' ORDER BY s."position", s."id") FROM "stages" s WHERE s."program_id" = p."id"), '[]'::jsonb),
      'stageAssessments', COALESCE((SELECT jsonb_agg(to_jsonb(sa) - 'created_at' - 'updated_at' ORDER BY sa."stage_id", sa."position", sa."id") FROM "stage_assessments" sa JOIN "stages" s ON s."id" = sa."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'modules', COALESCE((SELECT jsonb_agg(to_jsonb(m) - 'created_at' - 'updated_at' ORDER BY m."stage_id", m."position", m."id") FROM "modules" m JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'lessons', COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'created_at' - 'updated_at' ORDER BY l."module_id", l."position", l."id") FROM "lessons" l JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'contentBlocks', COALESCE((SELECT jsonb_agg(to_jsonb(cb) ORDER BY cb."lesson_id", cb."position", cb."id") FROM "content_blocks" cb JOIN "lessons" l ON l."id" = cb."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'resources', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."lesson_id", r."position", r."id") FROM "resources" r JOIN "lessons" l ON l."id" = r."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t."lesson_id", t."position", t."id") FROM "tasks" t JOIN "lessons" l ON l."id" = t."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'taskResources', COALESCE((SELECT jsonb_agg(to_jsonb(tr) ORDER BY tr."task_id", tr."resource_id") FROM "task_resources" tr JOIN "tasks" t ON t."id" = tr."task_id" JOIN "lessons" l ON l."id" = t."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'exercises', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e."lesson_id", e."position", e."id") FROM "exercises" e JOIN "lessons" l ON l."id" = e."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'concepts', COALESCE((SELECT jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' ORDER BY c."lesson_id", c."position", c."id") FROM "concepts" c JOIN "lessons" l ON l."id" = c."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'conceptResources', COALESCE((SELECT jsonb_agg(to_jsonb(cr) ORDER BY cr."concept_id", cr."resource_id") FROM "concept_resources" cr JOIN "concepts" c ON c."id" = cr."concept_id" JOIN "lessons" l ON l."id" = c."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'conceptAssessments', COALESCE((SELECT jsonb_agg(to_jsonb(ca) ORDER BY ca."concept_id", ca."position", ca."id") FROM "concept_assessments" ca JOIN "concepts" c ON c."id" = ca."concept_id" JOIN "lessons" l ON l."id" = c."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'conceptAssessmentQuestions', COALESCE((SELECT jsonb_agg(to_jsonb(cq) ORDER BY cq."assessment_id", cq."position", cq."id") FROM "concept_assessment_questions" cq JOIN "concept_assessments" ca ON ca."id" = cq."assessment_id" JOIN "concepts" c ON c."id" = ca."concept_id" JOIN "lessons" l ON l."id" = c."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'conceptAssessmentOptions', COALESCE((SELECT jsonb_agg(to_jsonb(co) ORDER BY co."question_id", co."position", co."id") FROM "concept_assessment_options" co JOIN "concept_assessment_questions" cq ON cq."id" = co."question_id" JOIN "concept_assessments" ca ON ca."id" = cq."assessment_id" JOIN "concepts" c ON c."id" = ca."concept_id" JOIN "lessons" l ON l."id" = c."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'quizzes', COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q."lesson_id", q."position", q."id") FROM "quizzes" q JOIN "lessons" l ON l."id" = q."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'questions', COALESCE((SELECT jsonb_agg(to_jsonb(qn) ORDER BY qn."quiz_id", qn."position", qn."id") FROM "questions" qn JOIN "quizzes" q ON q."id" = qn."quiz_id" JOIN "lessons" l ON l."id" = q."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb),
      'questionOptions', COALESCE((SELECT jsonb_agg(to_jsonb(qo) ORDER BY qo."question_id", qo."position", qo."id") FROM "question_options" qo JOIN "questions" qn ON qn."id" = qo."question_id" JOIN "quizzes" q ON q."id" = qn."quiz_id" JOIN "lessons" l ON l."id" = q."lesson_id" JOIN "modules" m ON m."id" = l."module_id" JOIN "stages" s ON s."id" = m."stage_id" WHERE s."program_id" = p."id"), '[]'::jsonb)
    ) AS snapshot_json
  FROM active_programs p
), inserted_versions AS (
  INSERT INTO "program_versions" (
    "program_id", "version", "checksum", "snapshot_json", "published_at", "published_by_user_id"
  )
  SELECT
    program_id,
    1,
    encode(digest(convert_to(snapshot_json::text, 'UTF8'), 'sha256'), 'hex'),
    snapshot_json,
    published_at,
    owner_id
  FROM snapshots
  RETURNING "id", "program_id"
)
UPDATE "programs" p
SET "published_version_id" = iv."id"
FROM inserted_versions iv
WHERE p."id" = iv."program_id";

ALTER TABLE "programs"
ADD CONSTRAINT "programs_published_version_id_fkey"
FOREIGN KEY ("published_version_id") REFERENCES "program_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
