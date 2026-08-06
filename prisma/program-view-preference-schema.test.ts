import { readFile } from 'node:fs/promises';

const migrationPath =
  'prisma/migrations/20260806090000_add_program_view_preferences/migration.sql';

describe('program view preference schema', () => {
  it('isole la préférence de la progression par utilisateur et programme', async () => {
    const schema = await readFile('prisma/schema.prisma', 'utf8');

    expect(schema).toContain('model ProgramViewPreference');
    expect(schema).toContain('expandedStageId String');
    expect(schema).toContain('@@unique([userId, programId])');
    expect(schema).toContain(
      '@relation(fields: [programId, expandedStageId], references: [programId, id], onDelete: Cascade)',
    );
    expect(schema).toContain('@@unique([programId, id])');
  });

  it('contraint l’étape développée au même programme en PostgreSQL', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain(
      'UNIQUE INDEX "stages_program_id_id_key"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("program_id", "expanded_stage_id")',
    );
    expect(migration).toContain(
      'REFERENCES "stages"("program_id", "id")',
    );
    expect(migration).toContain(
      'UNIQUE INDEX "program_view_preferences_user_id_program_id_key"',
    );
  });
});
