import { getDatabaseUrl } from '@/server/database-url';

describe('getDatabaseUrl', () => {
  it('returns a valid PostgreSQL URL', () => {
    const databaseUrl = 'postgresql://user:password@localhost:5432/learnx';

    expect(getDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });

  it('rejects a missing database URL', () => {
    expect(() => getDatabaseUrl({})).toThrow('DATABASE_URL is required');
  });

  it('rejects a non-PostgreSQL URL', () => {
    expect(() =>
      getDatabaseUrl({ DATABASE_URL: 'https://example.com' }),
    ).toThrow('DATABASE_URL must use the postgres or postgresql protocol.');
  });
});
