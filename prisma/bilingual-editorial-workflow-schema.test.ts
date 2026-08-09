import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260809210000_add_bilingual_editorial_workflow/migration.sql',
  ),
  'utf8',
);

describe('bilingual editorial workflow schema', () => {
  it('persists an additive, version-bound human review workflow', () => {
    expect(schema).toContain('model ProgramTranslationWorkflow');
    expect(schema).toContain('sourceProgramVersionId');
    expect(schema).toContain('linguisticReviewedAt');
    expect(schema).toContain('pedagogicalReviewedAt');
    expect(schema).toContain('culturalLegalReviewedAt');
    expect(schema).toContain('qaChecks');
    expect(schema).toContain('glossaryVersion');
    expect(migration).toContain('CREATE TABLE "program_translation_workflows"');
    expect(migration).toContain('REFERENCES "program_versions"("id")');
    expect(migration).not.toMatch(/DELETE FROM|DROP TABLE|DROP COLUMN/);
  });
});
