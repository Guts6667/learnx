import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('public contact identity migration', () => {
  it('backfills one normalized identity and keeps purposes separate', () => {
    const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(
      resolve(
        root,
        'prisma/migrations/20260810160000_add_public_contact_identity/migration.sql',
      ),
      'utf8',
    );

    expect(schema).toContain('model PublicContact');
    expect(schema).toContain('emailNormalized String       @unique');
    expect(schema).toContain('@@unique([contactId, purpose])');
    expect(migration).toContain('GROUP BY "email_normalized"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "public_leads_contact_id_purpose_key"',
    );
  });
});
