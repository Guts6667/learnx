import { readFileSync } from 'node:fs';

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

import { resolveDatasourceUrl } from './src/server/maintenance/prisma-datasource-guard';

// Captured before `.env` is merged in, because the whole question this guard
// answers is which of the two sources decided. `dotenv` does not overwrite an
// existing variable, so what is here now is what the command was invoked with.
const fromProcess = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
};

loadDotenv();

const fallbackDatabaseUrl =
  'postgresql://learnx:learnx@localhost:5432/learnx?schema=public';

const protectedHosts: string[] = JSON.parse(
  readFileSync(
    new URL('./quality/protected-db-hosts.json', import.meta.url),
    'utf8',
  ),
).hosts;

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: resolveDatasourceUrl({
      // Production migrates itself through `vercel:migrate`, and says so.
      allowProtected: process.env.LEARNX_ALLOW_PROTECTED_DB === '1',
      fallback: fallbackDatabaseUrl,
      fromProcess,
      merged: {
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
      },
      protectedHosts,
    }),
  },
});
