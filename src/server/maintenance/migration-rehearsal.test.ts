import { describe, expect, it } from 'vitest';

import {
  assertSafeReplaySchema,
  buildDigestBridgeSql,
  compareMigrationSnapshots,
  diffSchemaFingerprints,
  fingerprintSchemaObjects,
  migrationLedgerTable,
  normalizeSchemaReferences,
  schemaObjectsQuery,
  parseMigrationRehearsalArguments,
  resolveAppliedMigrationChecksums,
  type MigrationRow,
  type MigrationSnapshot,
  withDatabaseSchema,
} from '../../../scripts/migration-rehearsal.js';

function snapshot(checksum = 'stable'): MigrationSnapshot {
  return {
    generatedAt: '2026-08-09T00:00:00.000Z',
    migrations: { initial: 'migration-checksum' },
    scope: 'production-clone',
    tables: {
      notes: {
        checksum,
        columns: ['id', 'user_id', 'markdown'],
        count: 2,
      },
    },
    version: 1,
  };
}

describe('migration rehearsal', () => {
  const migrationRow = (
    overrides: Partial<MigrationRow> = {},
  ): MigrationRow => ({
    checksum: 'applied-checksum',
    finished_at: new Date('2026-08-24T19:42:28.000Z'),
    migration_name: 'activate_bounded_catalog',
    rolled_back_at: null,
    started_at: new Date('2026-08-24T19:42:27.000Z'),
    ...overrides,
  });

  it('ignores the pnpm argument separator', () => {
    expect(
      parseMigrationRehearsalArguments([
        '--',
        'snapshot',
        'migration-before.json',
      ]),
    ).toEqual(['snapshot', 'migration-before.json']);
  });

  it('keeps the pgcrypto bridge inside the disposable schema', () => {
    const sql = buildDigestBridgeSql('ci_migration_replay_123_1');
    expect(sql).toContain('"ci_migration_replay_123_1".digest');
    expect(sql).toContain('public.digest(data, algorithm)');
    expect(() => buildDigestBridgeSql('public')).toThrow();
  });

  it('reads the replay ledger from the disposable schema explicitly', () => {
    expect(migrationLedgerTable()).toBe('"_prisma_migrations"');
    expect(migrationLedgerTable('ci_migration_replay_123_1')).toBe(
      '"ci_migration_replay_123_1"."_prisma_migrations"',
    );
    expect(() => migrationLedgerTable('public')).toThrow();
  });

  it('accepts only disposable replay schemas', () => {
    expect(() =>
      assertSafeReplaySchema('ci_migration_replay_123_1'),
    ).not.toThrow();
    expect(() => assertSafeReplaySchema('public')).toThrow();
    expect(() =>
      assertSafeReplaySchema('ci_migration_replay_1;drop'),
    ).toThrow();
  });

  it('adds the isolated schema without changing the target database', () => {
    const result = new URL(
      withDatabaseSchema(
        'postgresql://user:secret@example.test/neondb?sslmode=require',
        'ci_migration_replay_123_1',
      ),
    );
    expect(result.pathname).toBe('/neondb');
    expect(result.searchParams.get('schema')).toBe('ci_migration_replay_123_1');
    expect(result.searchParams.get('sslmode')).toBe('require');
  });

  it('blocks row, checksum and migration-ledger divergences', () => {
    expect(compareMigrationSnapshots(snapshot(), snapshot())).toEqual([]);
    const changed = snapshot('changed');
    changed.tables.notes.count = 1;
    changed.migrations.initial = 'changed';
    expect(compareMigrationSnapshots(snapshot(), changed)).toEqual([
      'notes: row count changed from 2 to 1',
      'notes: protected row checksum changed',
      'initial: applied migration checksum changed or disappeared',
    ]);
  });

  it('keeps a successful retry after an earlier attempt was rolled back', () => {
    expect(
      resolveAppliedMigrationChecksums([
        migrationRow({
          checksum: 'failed-checksum',
          finished_at: null,
          rolled_back_at: new Date('2026-08-24T19:41:26.000Z'),
          started_at: new Date('2026-08-24T19:31:30.000Z'),
        }),
        migrationRow(),
      ]),
    ).toEqual({ activate_bounded_catalog: 'applied-checksum' });
  });

  it('rejects an unresolved migration attempt', () => {
    expect(() =>
      resolveAppliedMigrationChecksums([
        migrationRow({ finished_at: null, rolled_back_at: null }),
      ]),
    ).toThrow('Migration activate_bounded_catalog is not fully applied.');
  });

  it('rejects conflicting checksums across successful attempts', () => {
    expect(() =>
      resolveAppliedMigrationChecksums([
        migrationRow(),
        migrationRow({ checksum: 'different-checksum' }),
      ]),
    ).toThrow(
      'Migration activate_bounded_catalog has multiple applied checksums.',
    );
  });
});

describe('replayed schema equality', () => {
  const replaySchema = 'ci_migration_replay_1_1';

  function objects(schema: string) {
    return [
      { kind: 'table', identity: 'Lesson', definition: 'BASE TABLE' },
      {
        kind: 'constraint',
        identity: 'Lesson.Lesson_moduleId_fkey',
        definition: `FOREIGN KEY ("moduleId") REFERENCES ${schema}."Module"(id)`,
      },
      {
        kind: 'index',
        identity: 'Lesson.Lesson_pkey',
        definition: `CREATE UNIQUE INDEX "Lesson_pkey" ON ${schema}."Lesson" USING btree (id)`,
      },
    ];
  }

  it('rewrites each schema name to the same placeholder', () => {
    expect(
      normalizeSchemaReferences(
        `REFERENCES ${replaySchema}."Module"(id)`,
        replaySchema,
      ),
    ).toBe('REFERENCES <schema>."Module"(id)');
    expect(
      normalizeSchemaReferences('REFERENCES public."Module"(id)', 'public'),
    ).toBe('REFERENCES <schema>."Module"(id)');
  });

  it('reports no difference when only the schema name differs', () => {
    expect(
      diffSchemaFingerprints(
        fingerprintSchemaObjects(objects('public'), 'public'),
        fingerprintSchemaObjects(objects(replaySchema), replaySchema),
      ),
    ).toEqual([]);
  });

  it('orders objects so row order cannot mask a match', () => {
    const forward = fingerprintSchemaObjects(objects('public'), 'public');
    const reversed = fingerprintSchemaObjects(
      [...objects(replaySchema)].reverse(),
      replaySchema,
    );
    expect(diffSchemaFingerprints(forward, reversed)).toEqual([]);
  });

  // The negative test the gate exists for: a replay that drops a constraint
  // still exits zero, so the comparison is the only thing that catches it.
  it('fails when the replay is missing a constraint', () => {
    const replayed = objects(replaySchema).filter(
      (object) => object.kind !== 'constraint',
    );
    const differences = diffSchemaFingerprints(
      fingerprintSchemaObjects(objects('public'), 'public'),
      fingerprintSchemaObjects(replayed, replaySchema),
    );
    expect(differences).toHaveLength(1);
    expect(differences[0]).toContain('migrated only');
    expect(differences[0]).toContain('Lesson_moduleId_fkey');
  });

  it('detects a changed column type, nullability or default', () => {
    const migrated = fingerprintSchemaObjects(
      [
        {
          kind: 'column',
          identity: 'Lesson.title',
          definition: 'text nullable=NO',
        },
      ],
      'public',
    );
    const replayed = fingerprintSchemaObjects(
      [
        {
          kind: 'column',
          identity: 'Lesson.title',
          definition: 'text nullable=YES',
        },
      ],
      replaySchema,
    );
    expect(diffSchemaFingerprints(migrated, replayed)).toHaveLength(2);
  });

  it('detects an object the replay adds', () => {
    const differences = diffSchemaFingerprints(
      fingerprintSchemaObjects(objects('public'), 'public'),
      fingerprintSchemaObjects(
        [
          ...objects(replaySchema),
          { kind: 'table', identity: 'Ghost', definition: 'BASE TABLE' },
        ],
        replaySchema,
      ),
    );
    expect(differences).toEqual(['+ replayed only : table\tGhost\tBASE TABLE']);
  });

  it('bounds the diff so a wholesale mismatch stays readable', () => {
    const migrated = fingerprintSchemaObjects(
      Array.from({ length: 60 }, (_, index) => ({
        kind: 'table',
        identity: `Table${index}`,
        definition: 'BASE TABLE',
      })),
      'public',
    );
    const differences = diffSchemaFingerprints(migrated, []);
    expect(differences).toHaveLength(41);
    expect(differences.at(-1)).toBe('... and 20 further differences');
  });
});

describe('schema fingerprint query', () => {
  // The driver adapter rejects PostgreSQL `name` and `sql_identifier` columns
  // with UnsupportedNativeDataType. Every projected column must therefore be
  // cast, and only a real database catches it — hence this structural guard.
  it('casts every projected column of every branch to text', () => {
    const branches = schemaObjectsQuery('public').split('UNION ALL');
    expect(branches).toHaveLength(4);
    for (const branch of branches) {
      expect(branch.match(/::text/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('projects no bare identifier column', () => {
    const query = schemaObjectsQuery('public');
    expect(query).not.toMatch(/SELECT\s+'table'\s+AS/u);
    expect(query).not.toMatch(/,\s*table_name\s+AS/u);
    expect(query).not.toMatch(/,\s*indexdef\s/u);
  });

  it('refuses a schema name it cannot safely inline', () => {
    expect(() => schemaObjectsQuery("public'; DROP SCHEMA public; --")).toThrow(
      'Unsafe PostgreSQL schema name',
    );
    expect(() => schemaObjectsQuery('Public')).toThrow(
      'Unsafe PostgreSQL schema name',
    );
  });
});
