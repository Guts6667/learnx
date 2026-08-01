import 'dotenv/config';

import { prisma } from '../src/server/prisma';

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.info('PostgreSQL connection succeeded.');
}

try {
  await main();
} catch (error) {
  console.error('PostgreSQL connection failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
