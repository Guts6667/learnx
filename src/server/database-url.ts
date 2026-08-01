export function getDatabaseUrl(environment: NodeJS.ProcessEnv = process.env) {
  const databaseUrl = environment.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
  }

  const protocol = new URL(databaseUrl).protocol;

  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error(
      'DATABASE_URL must use the postgres or postgresql protocol.',
    );
  }

  return databaseUrl;
}
