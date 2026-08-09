import { describe, expect, it } from 'vitest';

import {
  assertSafeReplaySchema,
  compareMigrationSnapshots,
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
});
