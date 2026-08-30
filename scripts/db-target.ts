import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  planDbTarget,
  type DbTargetPlan,
} from '../src/server/maintenance/db-target';

/**
 * The only way a database command names its target (V4.5-192).
 *
 *   pnpm db:target -- --url '<connection string>' migrate-deploy --yes
 *   pnpm db:target -- --url '<connection string>' seed-preview
 *   pnpm db:target -- --url '<connection string>' execute --yes < file.sql
 *
 * Deliberately no `dotenv/config` import: reading `.env` here is the whole
 * failure. Both `DATABASE_URL` and `DIRECT_URL` are set from `--url`, because
 * `prisma.config.ts` reads DIRECT_URL first and a command that sets only
 * DATABASE_URL leaves the real target to whatever else is lying around. That
 * is how production was emptied on 30 August 2026.
 */

const ENV_FILES = ['.env', '.env.local', '.env.development'];

function parseArguments(argv: readonly string[]) {
  const args = [...argv];
  const url = args.includes('--url')
    ? args[args.indexOf('--url') + 1]
    : undefined;
  const confirmed = args.includes('--yes');
  const verb = args.find(
    (value, index) => !value.startsWith('--') && args[index - 1] !== '--url',
  );

  return { confirmed, url, verb: verb ?? '' };
}

function report(plan: DbTargetPlan): string {
  switch (plan.kind) {
    case 'PROCEED':
      return '';
    case 'REFUSED_NO_URL':
      return [
        'Refus : --url est obligatoire.',
        "Aucune valeur n'est reprise de l'environnement : une cible omise",
        'signifiait « ce que le shell contient », et c’est ainsi qu’une',
        'commande atteint une base que personne n’a nommée.',
      ].join('\n');
    case 'REFUSED_UNPARSEABLE_URL':
      return 'Refus : la chaîne de connexion est illisible.';
    case 'REFUSED_PROTECTED_HOST':
      return [
        `Refus : ${plan.host} est un hôte protégé.`,
        'Aucun outillage hors production ne l’atteint. La liste est dans',
        'quality/protected-db-hosts.json.',
      ].join('\n');
    case 'REFUSED_ENV_NAMES_PROTECTED_HOST':
      return [
        `Refus : ${plan.file} nomme l’hôte protégé ${plan.host}.`,
        'Cette commande ne tourne pas à côté d’un fichier qui pointe vers la',
        'production, même si elle ne l’aurait pas lu : c’est exactement le',
        'mécanisme de l’incident du 30 août 2026 (V4.5-192). Retirez la ligne',
        'ou lancez depuis un dossier qui ne l’a pas.',
      ].join('\n');
    case 'REFUSED_CONFIRMATION_REQUIRED':
      return [
        `Refus : « ${plan.verb} » modifie des données.`,
        `Cible : ${plan.host}`,
        'Relancez avec --yes si c’est bien cette base.',
      ].join('\n');
    case 'REFUSED_UNKNOWN_VERB':
      return `Refus : verbe inconnu « ${plan.verb} ». Attendu : execute, migrate-deploy, seed-preview.`;
  }
}

const COMMANDS: Record<string, readonly string[]> = {
  execute: ['prisma', 'db', 'execute', '--stdin'],
  'migrate-deploy': ['prisma', 'migrate', 'deploy'],
  'seed-preview': ['tsx', 'scripts/seed-preview.ts'],
};

function main() {
  const { confirmed, url, verb } = parseArguments(process.argv.slice(2));
  const protectedHosts: string[] = JSON.parse(
    readFileSync(resolve('quality/protected-db-hosts.json'), 'utf8'),
  ).hosts;

  const plan = planDbTarget({
    confirmed,
    envFiles: ENV_FILES.filter((file) => existsSync(resolve(file))).map(
      (file) => ({ contents: readFileSync(resolve(file), 'utf8'), path: file }),
    ),
    protectedHosts,
    url,
    verb,
  });

  if (plan.kind !== 'PROCEED') {
    console.error(report(plan));
    process.exitCode = 1;
    return;
  }

  // Printed before anything happens, every time. The incident was invisible
  // until afterwards.
  console.log(`Cible : ${plan.host} — base ${plan.database} — ${plan.verb}`);

  const [command, ...args] = COMMANDS[plan.verb] as [string, ...string[]];
  const child = spawn(command, args, {
    env: { ...process.env, ...plan.env },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}

main();
