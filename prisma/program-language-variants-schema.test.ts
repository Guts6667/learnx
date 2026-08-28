import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260809170000_add_program_language_variants/migration.sql',
  ),
  'utf8',
);

describe('program language variants schema', () => {
  it('backfills French variants and immutable pedagogical identities', () => {
    expect(schema).toContain('canonicalProgramKey');
    expect(schema.match(/canonicalKey\s+String/g)).toHaveLength(3);
    expect(schema).toContain(
      '@@unique([ownerId, canonicalProgramKey, locale])',
    );
    expect(migration).toContain('SET "canonical_program_key" = "slug"');
    expect(migration).toContain(
      'ADD CONSTRAINT "programs_locale_check" CHECK ("locale" IN (\'fr\', \'en\'))',
    );
    expect(migration).not.toMatch(/DELETE FROM|DROP TABLE|DROP COLUMN/);
  });
});
