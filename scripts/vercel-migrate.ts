import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { planVercelMigration } from '../src/server/maintenance/vercel-migrate.js';

/**
 * Runs during `pnpm build:vercel`. See the module for which builds migrate and
 * why. Deliberately no `dotenv/config` import: reading `.env` here is the whole
 * failure mode this guards against.
 */

const ENV_FILES = ['.env', '.env.local', '.env.development'];

/** The ref whose preview deployment owns the shared `preview` database. */
const PREVIEW_REF = 'dev';

const plan = planVercelMigration({
  envFiles: ENV_FILES.filter((file) => existsSync(resolve(file))),
  previewRef: PREVIEW_REF,
  ref: process.env.VERCEL_GIT_COMMIT_REF,
  vercelEnv: process.env.VERCEL_ENV,
});

if (plan.kind === 'REFUSED_ENV_FILE') {
  console.error(
    [
      `Refus : ${plan.file} est présent.`,
      'Ce script applique des migrations et ne tourne pas à côté d’un fichier',
      'qui peut nommer une autre base que celle du déploiement. C’est le',
      'mécanisme de l’incident du 30 août 2026 (V4.5-192).',
    ].join('\n'),
  );
  process.exit(1);
}

if (plan.kind === 'SKIP') {
  console.log(`prisma migrate deploy ignoré : ${plan.reason}.`);
  process.exit(0);
}

console.log(`prisma migrate deploy : ${plan.reason}.`);

const child = spawn('pnpm', ['prisma:deploy'], { stdio: 'inherit' });
child.on('exit', (code) => {
  process.exit(code ?? 1);
});
