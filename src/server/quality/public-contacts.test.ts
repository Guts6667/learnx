import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readPrismaSchemaSync } from '../../../prisma/schema-test-utils.js';

const root = process.cwd();

describe('public contact identity migration', () => {
  it('backfills one normalized identity and keeps purposes separate', () => {
    const schema = readPrismaSchemaSync(root);
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
