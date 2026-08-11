import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260805013000_add_rbac_and_audit/migration.sql'),
  'utf8',
);
const auditModel = schema.match(/model AuditEvent \{[\s\S]*?\n\}/)?.[0];

describe('V3 RBAC and audit schema', () => {
  it('adds CREATOR without assigning it to existing users', () => {
    expect(schema).toMatch(/enum Role \{[\s\S]*CREATOR/);
    expect(migration).toContain(
      'ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS \'creator\'',
    );
    expect(migration).not.toMatch(/UPDATE\s+"users"/i);
  });

  it('stores append-only audit facts without secret or PII columns', () => {
    expect(auditModel).toContain('model AuditEvent {');
    expect(auditModel).toContain('idempotencyKey');
    expect(auditModel).not.toMatch(/email|token|password/i);
    expect(migration).toContain('audit_events_metadata_object_check');
    expect(migration).not.toMatch(/UPDATE\s+"audit_events"/i);
  });

  it('enforces idempotence and useful audit lookup indexes', () => {
    expect(migration).toContain(
      'audit_events_actor_user_id_action_idempotency_key_key',
    );
    expect(migration).toContain('audit_events_action_created_at_idx');
    expect(migration).toContain(
      'audit_events_target_type_target_id_created_at_idx',
    );
  });

  it('is additive and leaves V2 learning and personal data untouched', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toMatch(
      /(?:UPDATE|DELETE FROM)\s+"(?:programs|stages|modules|lessons|notes|sessions|program_progress)"/i,
    );
  });
});
