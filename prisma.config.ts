import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const fallbackDatabaseUrl =
  'postgresql://learnx:learnx@localhost:5432/learnx?schema=public';

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url:
      process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
