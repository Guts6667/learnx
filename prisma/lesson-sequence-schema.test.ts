import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const migrationPath = resolve(
  'prisma/migrations/20260805210000_add_lesson_sequence/migration.sql',
);

describe('V3-017 lesson sequence migration', () => {
  it('backfills the exact V2 families without authoring COMPLETE or resources', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('\'CONTENT\'::"LessonSequenceKind"');
    expect(sql).toContain('\'TASK\'::"LessonSequenceKind"');
    expect(sql).toContain('\'CONCEPT_ASSESSMENT\'::"LessonSequenceKind"');
    expect(sql).toContain('\'EXERCISE\'::"LessonSequenceKind"');
    expect(sql).toContain('\'QUIZ\'::"LessonSequenceKind"');
    expect(sql).not.toMatch(/FROM "resources"\s+WHERE/);
    expect(sql).not.toContain('\'COMPLETE\'::"LessonSequenceKind"');
  });

  it('enforces same-lesson targets and immutable identities', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const table of [
      'content_blocks',
      'resources',
      'tasks',
      'concept_assessments',
      'exercises',
      'quizzes',
    ]) {
      expect(sql).toContain(`REFERENCES "${table}"("lesson_id", "id")`);
    }
    expect(sql).toContain('lesson_sequence_items_target_check');
    expect(sql).toContain('concept_assessments_lesson_id_concept_id_fkey');
    expect(sql).toContain('REFERENCES "concepts"("lesson_id", "id")');
    expect(sql).toContain('prevent_lesson_activity_identity_change');
    expect(sql).toContain('prevent_lesson_sequence_identity_change');
  });
});
