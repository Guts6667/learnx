import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260809150000_add_account_locale/migration.sql'),
  'utf8',
);

describe('account locale schema', () => {
  it('stores a French fallback on users and access requests', () => {
    for (const model of ['User', 'AccessRequest']) {
      expect(schema).toMatch(
        new RegExp(
          `model ${model} \\{[\\s\\S]*?locale\\s+String\\s+@default\\("fr"\\)[\\s\\S]*?\\n\\}`,
        ),
      );
    }
    expect(migration).toContain(
      'ADD COLUMN "locale" VARCHAR(2) NOT NULL DEFAULT \'fr\'',
    );
    expect(migration).toContain(
      'CHECK ("locale" IN (\'fr\', \'en\'))',
    );
  });
});
