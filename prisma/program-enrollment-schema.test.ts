import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260805183000_add_program_enrollments/migration.sql',
  ),
  'utf8',
);

describe('V3 program enrollment schema', () => {
  it('lie une inscription unique à une version du même programme', () => {
    expect(schema).toContain('model ProgramEnrollment {');
    expect(schema).toContain('@@unique([userId, programId])');
    expect(schema).toContain(
      'program          Program                 @relation(fields: [programId]',
    );
    expect(schema).toContain(
      'programVersion   ProgramVersion          @relation(fields: [programVersionId]',
    );
    expect(migration).toContain('program_enrollments_program_version_fkey');
    expect(migration).toContain(
      'REFERENCES "program_versions"("program_id", "id")',
    );
  });

  it('contraint les états actif et désinscrit sans supprimer la ligne', () => {
    expect(schema).toContain('enum ProgramEnrollmentStatus {');
    expect(schema).toContain('WITHDRAWN @map("withdrawn")');
    expect(migration).toContain('program_enrollments_status_consistency_check');
    expect(migration).toContain(
      '("status" = \'active\' AND "withdrawn_at" IS NULL)',
    );
    expect(migration).toContain(
      '("status" = \'withdrawn\' AND "withdrawn_at" IS NOT NULL)',
    );
  });

  it('backfille propriétaires et progressions existantes sans doublon', () => {
    expect(migration).toContain(
      'SELECT p."owner_id" AS user_id, p."id" AS program_id',
    );
    expect(migration).toContain('FROM "program_progress" pp');
    expect(migration).toContain(
      'ON CONFLICT ("user_id", "program_id") DO NOTHING',
    );
  });

  it('reste additive et ne réécrit aucune donnée personnelle', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toMatch(
      /(?:UPDATE|DELETE FROM)\s+"(?:users|notes|sessions|program_progress|lesson_progress|quiz_attempts|concept_assessment_attempts|exercise_submissions)"/i,
    );
  });
});
