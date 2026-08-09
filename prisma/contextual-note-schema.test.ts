import { readFile } from 'node:fs/promises';

const schemaPath = 'prisma/schema.prisma';
const migrationPath =
  'prisma/migrations/20260809010000_add_contextual_note_activity/migration.sql';

describe('contextual note schema', () => {
  it('relie facultativement une note à une identité stable d’activité', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toContain(
      'sequenceItem   LessonSequenceItem? @relation(fields: [sequenceItemId], references: [id], onDelete: SetNull)',
    );
    expect(schema).toContain('@@unique([userId, creationKey])');
    expect(schema).toContain('@@index([sequenceItemId])');
  });

  it('applique une migration additive et préserve la note si la cible disparaît', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN "sequence_item_id" UUID');
    expect(migration).toContain('ADD COLUMN "creation_key" UUID');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "notes_user_id_creation_key_key"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("sequence_item_id") REFERENCES "lesson_sequence_items"("id")',
    );
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
  });
});
