import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    'prisma/migrations/20260805150000_add_program_visibility/migration.sql',
  ),
  'utf8',
);

describe('V3 program visibility schema', () => {
  it('sépare la visibilité du statut de publication', () => {
    expect(schema).toMatch(/enum ProgramVisibility \{[\s\S]*PRIVATE[\s\S]*PUBLIC/);
    expect(schema).toMatch(/status\s+ProgramStatus\s+@default\(DRAFT\)/);
    expect(schema).toMatch(
      /visibility\s+ProgramVisibility\s+@default\(PRIVATE\)/,
    );
  });

  it('préserve le comportement historique avec un backfill privé', () => {
    expect(migration).toContain(
      '"visibility" "program_visibility" NOT NULL DEFAULT \'private\'',
    );
    expect(migration).not.toMatch(/UPDATE\s+"programs"/i);
  });

  it('est additive et ne touche ni propriétaire ni données personnelles', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(migration).not.toMatch(
      /(?:UPDATE|DELETE FROM)\s+"(?:users|notes|sessions|program_progress)"/i,
    );
    expect(migration).not.toMatch(/owner_id/i);
  });
});
