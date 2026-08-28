import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from './schema-test-utils.js';

const schema = readPrismaSchemaSync();
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260805170000_add_program_versions/migration.sql',
  ),
  'utf8',
);

describe('V3 program version schema', () => {
  it('stocke des versions immuables identifiées par numéro et checksum', () => {
    expect(schema).toContain('model ProgramVersion {');
    expect(schema).toMatch(/snapshot\s+Json\s+@map\("snapshot_json"\)/);
    expect(schema).toContain('@@unique([programId, version])');
    expect(schema).toContain('@@unique([programId, checksum])');
    expect(migration).toContain('program_versions_checksum_sha256_check');
  });

  it('backfille les programmes actifs et leur pointeur sans toucher aux données personnelles', () => {
    expect(migration).toMatch(/WHERE p\."status" = 'active'/);
    expect(migration).toContain('INSERT INTO "program_versions"');
    expect(migration).toContain('SET "published_version_id" = iv."id"');
    expect(migration).not.toMatch(
      /(?:UPDATE|DELETE FROM)\s+"(?:users|notes|sessions|program_progress|lesson_progress)"/i,
    );
  });

  it('capture les identités et contenus pédagogiques existants', () => {
    for (const key of [
      'stages',
      'modules',
      'lessons',
      'contentBlocks',
      'resources',
      'tasks',
      'exercises',
      'conceptAssessments',
      'quizzes',
      'stageAssessments',
    ]) {
      expect(migration).toContain(`'${key}'`);
    }
  });

  it('reste additive pour permettre un rollback applicatif', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toMatch(/DELETE FROM/i);
  });
});
