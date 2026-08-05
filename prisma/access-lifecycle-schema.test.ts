import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260805003000_add_access_lifecycle_schema/migration.sql',
  ),
  'utf8',
);

function enumBlock(name: string): string {
  const match = schema.match(new RegExp(`enum ${name} \\{[\\s\\S]*?\\n\\}`));

  if (!match) throw new Error(`Missing ${name} enum.`);
  return match[0];
}

describe('V3 access lifecycle schema', () => {
  it('keeps passwords required and backfills existing users as active', () => {
    expect(schema).toContain('passwordHash                 String');
    expect(schema).toContain(
      'accountStatus                AccountStatus                 @default(ACTIVE)',
    );
    expect(migration).toContain(
      'ADD COLUMN "account_status" "account_status" NOT NULL DEFAULT \'active\'',
    );
    expect(migration).toContain('users_account_status_consistency_check');
  });

  it('defines only the lifecycle enums and models owned by V3-002', () => {
    expect(enumBlock('AccountStatus')).toContain('SUSPENDED');
    expect(enumBlock('AccessRequestStatus')).toContain('PENDING_EMAIL');
    expect(enumBlock('AccessRequestStatus')).toContain('PENDING_APPROVAL');
    expect(enumBlock('AccessRequestStatus')).toContain('APPROVED');
    expect(enumBlock('AccessRequestStatus')).toContain('REJECTED');
    expect(migration).not.toContain("ADD VALUE IF NOT EXISTS 'creator'");
    expect(schema).toContain('model AccessRequest {');
    expect(schema).toContain('model EmailVerification {');
    expect(schema).toContain('model AccessInvitation {');
    expect(migration).not.toContain('CREATE TABLE "program_enrollments"');
    expect(migration).not.toContain('CREATE TABLE "audit_events"');
  });

  it('enforces one open request and one active token per request', () => {
    expect(migration).toContain('access_requests_open_email_key');
    expect(migration).toContain(
      "WHERE \"status\" IN ('pending_email', 'pending_approval', 'approved')",
    );
    expect(migration).toContain('email_verifications_active_request_key');
    expect(migration).toContain('access_invitations_active_request_key');
    expect(migration).toContain(
      'WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL',
    );
  });

  it('guards row states, expiry, token terminal states and parent states', () => {
    expect(migration).toContain('access_requests_status_consistency_check');
    expect(migration).toContain('email_verifications_expiry_check');
    expect(migration).toContain('email_verifications_terminal_state_check');
    expect(migration).toContain('access_invitations_expiry_check');
    expect(migration).toContain('access_invitations_terminal_state_check');
    expect(migration).toContain('email_verifications_request_state_guard');
    expect(migration).toContain('access_invitations_request_state_guard');
  });

  it('is additive and leaves existing roles and learning data untouched', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toContain('ALTER COLUMN "password_hash"');
    expect(migration).not.toContain('ALTER TYPE "user_role"');
    expect(migration).not.toMatch(
      /(?:UPDATE|DELETE FROM)\s+"(?:programs|stages|modules|lessons|notes|program_progress)"/i,
    );
  });
});
