import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { PrismaNeon } from '@prisma/adapter-neon';

import { requireEphemeralIntegrationDatabase } from '../src/server/integration-database.js';

const migrationsDirectory = resolve('prisma/migrations');
const replaySchemaPrefix = 'ci_migration_replay_';

export interface MigrationSnapshot {
  generatedAt: string;
  migrations: Record<string, string>;
  scope: 'production-clone';
  tables: Record<string, TableSnapshot>;
  version: 1;
}

export interface TableSnapshot {
  checksum: string;
  columns: string[];
  count: number;
}

interface ColumnRow {
  column_name: string;
  table_name: string;
}

interface DigestRow {
  checksum: string;
  count: string;
}

export interface MigrationRow {
  checksum: string;
  finished_at: Date | null;
  migration_name: string;
  rolled_back_at: Date | null;
  started_at: Date;
}

interface ExtensionFunctionRow {
  available: boolean;
}

type RawClient = {
  $disconnect(): Promise<void>;
  $executeRawUnsafe(query: string): Promise<number>;
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

export function assertSafeReplaySchema(schema: string): void {
  if (!new RegExp(`^${replaySchemaPrefix}[a-z0-9_]+$`).test(schema)) {
    throw new Error(
      `Replay schema must start with ${replaySchemaPrefix} and contain only lowercase letters, digits or underscores.`,
    );
  }
}

export function withDatabaseSchema(
  databaseUrl: string,
  schema: string,
): string {
  assertSafeReplaySchema(schema);
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

export function parseMigrationRehearsalArguments(args: string[]): string[] {
  return args.filter((value) => value !== '--');
}

export function buildDigestBridgeSql(schema: string): string {
  assertSafeReplaySchema(schema);
  return `CREATE FUNCTION ${quoteIdentifier(schema)}.digest(data bytea, algorithm text)
          RETURNS bytea
          LANGUAGE SQL
          IMMUTABLE STRICT PARALLEL SAFE
          AS 'SELECT public.digest(data, algorithm)'`;
}

interface SchemaObjectRow {
  definition: string;
  identity: string;
  kind: string;
}

/** Placeholder standing in for whichever schema a definition was read from. */
const schemaPlaceholder = '<schema>';

function assertQueryableSchema(schema: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error(`Unsafe PostgreSQL schema name: ${schema}`);
  }
}

/**
 * A replayed schema is structurally identical to the migrated one but says its
 * own name everywhere PostgreSQL qualifies an object — constraint bodies,
 * column defaults, index definitions. Comparing raw text would report those as
 * differences and drown the real ones, so both sides are rewritten to the same
 * placeholder before comparison.
 */
export function normalizeSchemaReferences(
  definition: string,
  schema: string,
): string {
  assertQueryableSchema(schema);
  const escaped = schema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return definition
    .replace(new RegExp(`"${escaped}"`, 'g'), `"${schemaPlaceholder}"`)
    .replace(new RegExp(`\\b${escaped}\\b`, 'g'), schemaPlaceholder);
}

export function fingerprintSchemaObjects(
  rows: SchemaObjectRow[],
  schema: string,
): string[] {
  return rows
    .map(
      ({ kind, identity, definition }) =>
        `${kind}\t${identity}\t${normalizeSchemaReferences(definition, schema)}`,
    )
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/**
 * Readable, bounded diff. A replay that exits zero proves only that every
 * migration ran; it says nothing about the shape it produced. This is what
 * turns "it ran" into "it matches".
 */
export function diffSchemaFingerprints(
  migrated: string[],
  replayed: string[],
  limit = 40,
): string[] {
  const inReplayed = new Set(replayed);
  const inMigrated = new Set(migrated);
  const differences = [
    ...migrated
      .filter((line) => !inReplayed.has(line))
      .map((line) => `- migrated only : ${line}`),
    ...replayed
      .filter((line) => !inMigrated.has(line))
      .map((line) => `+ replayed only : ${line}`),
  ];
  return differences.length > limit
    ? [
        ...differences.slice(0, limit),
        `... and ${differences.length - limit} further differences`,
      ]
    : differences;
}

/**
 * Every identifier column read here is a PostgreSQL `name` or
 * `information_schema.sql_identifier`, not `text`. The Neon driver adapter
 * refuses those with UnsupportedNativeDataType, so each returned column is cast
 * explicitly — including the literal `kind`, which arrives as `unknown`.
 */
export function schemaObjectsQuery(schema: string): string {
  assertQueryableSchema(schema);
  const literal = `'${schema}'`;
  return `
    SELECT 'table'::text AS kind,
           table_name::text AS identity,
           table_type::text AS definition
      FROM information_schema.tables WHERE table_schema = ${literal}
    UNION ALL
    SELECT 'column'::text,
           (table_name || '.' || column_name)::text,
           (data_type
             || ' nullable=' || is_nullable
             || ' default=' || coalesce(column_default, '-')
             || ' length=' || coalesce(character_maximum_length::text, '-')
             || ' numeric=' || coalesce(numeric_precision::text, '-')
             || ',' || coalesce(numeric_scale::text, '-')
             || ' position=' || ordinal_position::text)::text
      FROM information_schema.columns WHERE table_schema = ${literal}
    UNION ALL
    SELECT 'constraint'::text,
           (rel.relname || '.' || con.conname)::text,
           pg_get_constraintdef(con.oid)::text
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = ${literal}
    UNION ALL
    SELECT 'index'::text,
           (tablename || '.' || indexname)::text,
           indexdef::text
      FROM pg_indexes WHERE schemaname = ${literal}
  `;
}

async function schemaFingerprint(
  client: RawClient,
  schema: string,
): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<SchemaObjectRow[]>(
    schemaObjectsQuery(schema),
  );
  return fingerprintSchemaObjects(rows, schema);
}

export function migrationLedgerTable(schema?: string): string {
  if (!schema) return '"_prisma_migrations"';
  assertSafeReplaySchema(schema);
  return `${quoteIdentifier(schema)}."_prisma_migrations"`;
}

export function compareMigrationSnapshots(
  before: MigrationSnapshot,
  after: MigrationSnapshot,
): string[] {
  const differences: string[] = [];

  for (const [tableName, expected] of Object.entries(before.tables)) {
    const actual = after.tables[tableName];
    if (!actual) {
      differences.push(`${tableName}: table missing after migration`);
      continue;
    }
    if (actual.count !== expected.count) {
      differences.push(
        `${tableName}: row count changed from ${expected.count} to ${actual.count}`,
      );
    }
    if (actual.checksum !== expected.checksum) {
      differences.push(`${tableName}: protected row checksum changed`);
    }
  }

  for (const [migrationName, checksum] of Object.entries(before.migrations)) {
    if (after.migrations[migrationName] !== checksum) {
      differences.push(
        `${migrationName}: applied migration checksum changed or disappeared`,
      );
    }
  }

  return differences;
}

export function resolveAppliedMigrationChecksums(
  rows: MigrationRow[],
): Record<string, string> {
  const checksums: Record<string, string> = {};

  for (const row of rows) {
    if (!row.finished_at && !row.rolled_back_at) {
      throw new Error(`Migration ${row.migration_name} is not fully applied.`);
    }
    if (row.rolled_back_at) continue;

    const existingChecksum = checksums[row.migration_name];
    if (existingChecksum && existingChecksum !== row.checksum) {
      throw new Error(
        `Migration ${row.migration_name} has multiple applied checksums.`,
      );
    }
    checksums[row.migration_name] = row.checksum;
  }

  return checksums;
}

async function createClient(connectionString: string): Promise<RawClient> {
  const { PrismaClient } = await import('../generated/prisma/client.js');
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
    log: ['error'],
  }) as RawClient;
}

async function localMigrationChecksums(): Promise<Record<string, string>> {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrations = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const checksums: Record<string, string> = {};

  for (const migration of migrations) {
    const sql = await readFile(
      resolve(migrationsDirectory, migration, 'migration.sql'),
    );
    checksums[migration] = createHash('sha256').update(sql).digest('hex');
  }

  return checksums;
}

async function appliedMigrationChecksums(
  client: RawClient,
  schema?: string,
): Promise<Record<string, string>> {
  const rows = await client.$queryRawUnsafe<MigrationRow[]>(
    `SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
     FROM ${migrationLedgerTable(schema)}
     ORDER BY migration_name, started_at`,
  );
  return resolveAppliedMigrationChecksums(rows);
}

async function listTableColumns(client: RawClient): Promise<ColumnRow[]> {
  return client.$queryRawUnsafe<ColumnRow[]>(
    `SELECT table_name::text AS table_name,
            column_name::text AS column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name <> '_prisma_migrations'
     ORDER BY table_name, ordinal_position`,
  );
}

async function snapshotTable(
  client: RawClient,
  tableName: string,
  columns: string[],
): Promise<TableSnapshot> {
  const table = quoteIdentifier(tableName);
  const values = columns.map(quoteIdentifier).join(', ');
  const rows = await client.$queryRawUnsafe<DigestRow[]>(
    `SELECT COUNT(*)::text AS count,
            md5(COALESCE(string_agg(row_checksum, '' ORDER BY row_checksum), '')) AS checksum
     FROM (
       SELECT md5(jsonb_build_array(${values})::text) AS row_checksum
       FROM ${table}
     ) AS protected_rows`,
  );
  const row = rows[0];

  if (!row) throw new Error(`Unable to snapshot ${tableName}.`);
  return { checksum: row.checksum, columns, count: Number(row.count) };
}

async function captureSnapshot(
  client: RawClient,
  protectedColumns?: Record<string, string[]>,
): Promise<MigrationSnapshot> {
  const columnsByTable: Record<string, string[]> = {};
  for (const row of await listTableColumns(client)) {
    (columnsByTable[row.table_name] ??= []).push(row.column_name);
  }

  const tableColumns = protectedColumns ?? columnsByTable;
  const tables: Record<string, TableSnapshot> = {};
  for (const [tableName, columns] of Object.entries(tableColumns).sort()) {
    const available = columnsByTable[tableName];
    if (!available || columns.some((column) => !available.includes(column))) {
      continue;
    }
    tables[tableName] = await snapshotTable(client, tableName, columns);
  }

  return {
    generatedAt: new Date().toISOString(),
    migrations: await appliedMigrationChecksums(client),
    scope: 'production-clone',
    tables,
    version: 1,
  };
}

async function writeSnapshot(outputPath: string): Promise<void> {
  requireEphemeralIntegrationDatabase();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const client = await createClient(databaseUrl);
  try {
    const snapshot = await captureSnapshot(client);
    await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.info(
      `Captured ${Object.keys(snapshot.tables).length} table checksums without row contents.`,
    );
  } finally {
    await client.$disconnect();
  }
}

async function compareSnapshot(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  requireEphemeralIntegrationDatabase();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const before = JSON.parse(
    await readFile(inputPath, 'utf8'),
  ) as MigrationSnapshot;
  const protectedColumns = Object.fromEntries(
    Object.entries(before.tables).map(([tableName, table]) => [
      tableName,
      table.columns,
    ]),
  );
  const client = await createClient(databaseUrl);
  try {
    const after = await captureSnapshot(client, protectedColumns);
    const local = await localMigrationChecksums();
    const differences = compareMigrationSnapshots(before, after);
    for (const [migrationName, checksum] of Object.entries(local)) {
      if (after.migrations[migrationName] !== checksum) {
        differences.push(
          `${migrationName}: local migration is absent or has another checksum in the clone`,
        );
      }
    }
    await writeFile(outputPath, `${JSON.stringify(after, null, 2)}\n`);
    if (differences.length > 0) {
      throw new Error(
        `Migration rehearsal blocked:\n${differences.join('\n')}`,
      );
    }
    console.info(
      `Preserved ${Object.keys(before.tables).length} tables and verified ${Object.keys(local).length} migrations.`,
    );
  } finally {
    await client.$disconnect();
  }
}

async function replayAllMigrations(schema: string): Promise<void> {
  requireEphemeralIntegrationDatabase();
  assertSafeReplaySchema(schema);
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL ?? databaseUrl;
  if (!databaseUrl || !directUrl) {
    throw new Error('DATABASE_URL and DIRECT_URL are required.');
  }

  const primaryClient = await createClient(databaseUrl);
  const replayDatabaseUrl = withDatabaseSchema(databaseUrl, schema);
  const replayDirectUrl = withDatabaseSchema(directUrl, schema);
  let replayClient: RawClient | undefined;

  try {
    await primaryClient.$executeRawUnsafe(
      `CREATE SCHEMA ${quoteIdentifier(schema)}`,
    );
    const [digestFunction] = await primaryClient.$queryRawUnsafe<
      ExtensionFunctionRow[]
    >(
      `SELECT to_regprocedure('public.digest(bytea,text)') IS NOT NULL AS available`,
    );
    if (digestFunction?.available) {
      await primaryClient.$executeRawUnsafe(buildDigestBridgeSql(schema));
    }
    const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const deploy = spawnSync(pnpm, ['prisma:deploy'], {
      env: {
        ...process.env,
        DATABASE_URL: replayDatabaseUrl,
        DIRECT_URL: replayDirectUrl,
      },
      stdio: 'inherit',
    });
    if (deploy.error) throw deploy.error;
    if (deploy.status !== 0) {
      throw new Error(`Full migration replay exited with ${deploy.status}.`);
    }

    replayClient = await createClient(replayDatabaseUrl);
    const applied = await appliedMigrationChecksums(replayClient, schema);
    const local = await localMigrationChecksums();
    const missing = Object.entries(local).filter(
      ([migrationName, checksum]) => applied[migrationName] !== checksum,
    );
    if (
      missing.length > 0 ||
      Object.keys(applied).length !== Object.keys(local).length
    ) {
      throw new Error(
        'Full replay migration ledger differs from local migrations.',
      );
    }
    console.info(
      `Replayed all ${Object.keys(local).length} migrations in isolated schema ${schema}.`,
    );

    // The ledger check above proves every migration ran. It does not prove the
    // shape they produced: a guard that silently skipped would still exit zero
    // on a schema that differs from production. Compare the two structures
    // while the replay schema still exists — the finally below drops it.
    const migratedFingerprint = await schemaFingerprint(
      primaryClient,
      'public',
    );
    const replayedFingerprint = await schemaFingerprint(replayClient, schema);
    const differences = diffSchemaFingerprints(
      migratedFingerprint,
      replayedFingerprint,
    );
    if (differences.length > 0) {
      // Counts first: a one-sided diff means the two sides were not read the
      // same way, which is a different problem from two schemas disagreeing.
      console.error(
        `Migrated schema: ${migratedFingerprint.length} objects. ` +
          `Replayed schema: ${replayedFingerprint.length} objects.`,
      );
      if (replayedFingerprint.length === 0) {
        console.error(
          `Read no object at all in schema ${schema}. The replay reported success, ` +
            'so this is a reading fault, not a schema difference.',
        );
      }
      console.error(
        `Replayed schema differs from the migrated schema:\n${differences.join('\n')}`,
      );
      throw new Error(
        `Replayed schema differs from the migrated schema in ${differences.length} place(s).`,
      );
    }
    console.info(
      `Replayed schema matches the migrated schema across ${migratedFingerprint.length} objects.`,
    );
  } finally {
    await replayClient?.$disconnect();
    await primaryClient.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`,
    );
    await primaryClient.$disconnect();
  }
}

function requiredArgument(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

async function main(): Promise<void> {
  const [command, first, second] = parseMigrationRehearsalArguments(
    process.argv.slice(2),
  );
  if (command === 'snapshot') {
    await writeSnapshot(requiredArgument(first, 'output path'));
    return;
  }
  if (command === 'compare') {
    await compareSnapshot(
      requiredArgument(first, 'input path'),
      requiredArgument(second, 'output path'),
    );
    return;
  }
  if (command === 'replay-all') {
    await replayAllMigrations(requiredArgument(first, 'schema'));
    return;
  }
  throw new Error(
    'Usage: migration-rehearsal.ts snapshot <output> | compare <before> <after> | replay-all <schema>',
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
