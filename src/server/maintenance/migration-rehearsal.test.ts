import { describe, expect, it } from 'vitest';

import {
  assertSafeReplaySchema,
  buildDigestBridgeSql,
  compareMigrationSnapshots,
  migrationLedgerTable,
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
