import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260822120000_add_ai_correction_attempt_request_audit/migration.sql',
  ),
  'utf8',
);

function aiCorrectionAttemptModel(): string {
  const start = schema.indexOf('model AiCorrectionAttempt {');
  const end = schema.indexOf('\nmodel AiCorrectionPipelineVersion', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return schema.slice(start, end);
}

function aiCorrectionCostSourceEnum(): string {
  const start = schema.indexOf('enum AiCorrectionCostSource {');
  const end = schema.indexOf('\nenum CreditCurrency', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return schema.slice(start, end);
}

describe('AI correction attempt request audit persistence', () => {
  it('adds nullable manifest, body hash, wire-schema hash and router metadata fields', () => {
    const attempt = aiCorrectionAttemptModel();

    expect(attempt).toMatch(
      /requestManifest\s+Json\?\s+@map\("request_manifest_json"\)/,
    );
    expect(attempt).toMatch(
      /requestBodySha256\s+String\?\s+@map\("request_body_sha256"\) @db\.Char\(64\)/,
    );
    expect(attempt).toMatch(
      /wireSchemaSha256\s+String\?\s+@map\("wire_schema_sha256"\) @db\.Char\(64\)/,
    );
    expect(attempt).toMatch(
      /routerMetadata\s+Json\?\s+@map\("router_metadata_json"\)/,
    );
  });

  it('keeps legacy attempts readable with null audit values and no backfill', () => {
    expect(migration).toContain('ADD COLUMN "request_manifest_json" JSONB');
    expect(migration).toContain('ADD COLUMN "request_body_sha256" CHAR(64)');
    expect(migration).toContain('ADD COLUMN "wire_schema_sha256" CHAR(64)');
    expect(migration).toContain('ADD COLUMN "router_metadata_json" JSONB');
    expect(migration).not.toMatch(
      /NOT NULL|DEFAULT|UPDATE\s+"ai_correction_attempts"/,
    );
    expect(migration).not.toMatch(/DROP\s+(COLUMN|TABLE)/);
  });

  it('accepts only lowercase SHA-256 values when hashes are present', () => {
    expect(migration).toContain(
      'ai_correction_attempts_request_body_sha256_check',
    );
    expect(migration).toContain(
      'ai_correction_attempts_wire_schema_sha256_check',
    );
    expect(migration.match(/\^\[0-9a-f\]\{64\}\$/g)).toHaveLength(2);
  });

  it('persists an explicit cost source without converting unknown legacy costs', () => {
    const attempt = aiCorrectionAttemptModel();
    const costSource = aiCorrectionCostSourceEnum();
    const values = [...costSource.matchAll(/^\s{2}([A-Z_]+)\s+@map/gmu)].map(
      ([, value]) => value,
    );

    expect(values).toEqual(['ACTUAL', 'CONSERVATIVE_WRITE_OFF']);
    expect(costSource).toContain('@@map("ai_correction_cost_source")');
    expect(attempt).toMatch(
      /costSource\s+AiCorrectionCostSource\?\s+@map\("cost_source"\)/,
    );
    expect(migration).toContain(
      'CREATE TYPE "ai_correction_cost_source" AS ENUM',
    );
    expect(migration).toContain("'actual'");
    expect(migration).toContain("'conservative_write_off'");
    expect(migration).toContain(
      'ADD COLUMN "cost_source" "ai_correction_cost_source"',
    );
    expect(migration).not.toMatch(/"cost_source"[^,;]*(?:NOT NULL|DEFAULT)/u);
    expect(migration).not.toMatch(/UPDATE\s+"ai_correction_attempts"/u);
  });

  it('limits audit JSON to objects and rejects secret or request-content keys', () => {
    expect(migration).toContain(
      'ai_correction_attempts_request_manifest_object_check',
    );
    expect(migration).toContain(
      'ai_correction_attempts_router_metadata_object_check',
    );
    expect(migration).toContain(
      'ai_correction_attempts_request_manifest_no_sensitive_keys_check',
    );
    expect(migration).toContain(
      'ai_correction_attempts_router_metadata_no_sensitive_keys_check',
    );
    expect(migration).toContain('authorization|cookie|headers|api[_-]?key');
    expect(migration).toContain('messages|content|prompt|submission');
    expect(migration).toContain('no_bearer_check');
  });

  it('reuses existing provider identities and call-level idempotence', () => {
    const attempt = aiCorrectionAttemptModel();

    expect(attempt).toMatch(/provider\s+String\?/);
    expect(attempt).toMatch(
      /generationId\s+String\?\s+@map\("generation_id"\)/,
    );
    expect(attempt).toMatch(
      /providerRequestId\s+String\?\s+@map\("provider_request_id"\)/,
    );
    expect(attempt).toMatch(
      /providerIdempotencyKey\s+String\?\s+@unique @map\("provider_idempotency_key"\)/,
    );
    expect(migration).not.toMatch(
      /ADD COLUMN "(provider|generation_id|provider_request_id|provider_idempotency_key)"/,
    );
  });

  it('keeps CALL_INTENT as the persisted pre-dispatch state', () => {
    expect(schema).toContain('CALL_INTENT @map("call_intent")');
    expect(schema).toContain('dispatchStatus');
    expect(migration).not.toMatch(/ALTER TYPE "ai_provider_dispatch_status"/);
  });
});
