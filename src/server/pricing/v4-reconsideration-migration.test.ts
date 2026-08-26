import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260826120000_add_correction_reconsideration/migration.sql',
);

describe('V4 reconsideration migration', () => {
  it('pins one bounded reconsideration to the offered-credit pilot catalog', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain(
      '"ai_corrections_reconsideration_of_id_key"',
    );
    expect(migration).toContain(
      '"ai_pricing_quotes_reconsideration_context_check"',
    );
    expect(migration).toContain(
      'char_length(btrim("reconsideration_argument")) BETWEEN 20 AND 500',
    );
    expect(migration).toContain("'reconsideration'");
    expect(migration).toContain(
      "'[\"writing\", \"reflection\", \"practice\", \"project\"]'::jsonb",
    );
    expect(migration).toContain(
      "'[\"writing\"]'::jsonb",
    );
    expect(migration).toContain("'{reconsiderationPromptExtensionVersion}'");
    expect(migration).toContain("#- '{pilotScope,activityType}'");
    expect(migration).not.toMatch(/stripe|purchased_credit/i);
  });
});
