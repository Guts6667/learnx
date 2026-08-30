/**
 * The guard inside `prisma.config.ts` (V4.5-192).
 *
 * The wrapper `pnpm db:target` makes a named target the only way to run a
 * database command, but it protects only the commands that go through it. The
 * Prisma CLI can still be invoked directly, and on 30 August 2026 it was: a
 * connection string on the command line set `DATABASE_URL`, a worktree `.env`
 * set `DIRECT_URL` to production, this config preferred `DIRECT_URL`, and
 * production was emptied. Nothing in between said which one had won.
 *
 * So the preference is gone. When the two disagree — or when the one that
 * decides came from a file while the other came from the command — this
 * refuses and names both hosts, because the failure was never that the wrong
 * value existed. It was that nobody could see which value was in use.
 */

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/**
 * The same Neon endpoint is reachable under two hostnames, and a correct
 * configuration uses both at once: `DATABASE_URL` goes through the connection
 * pooler, `DIRECT_URL` bypasses it, because migrations cannot run pooled. Neon
 * spells the difference as a `-pooler` suffix on the first label —
 * `ep-bold-rain-as6nh8m7-pooler.c-4.eu-central-1.aws.neon.tech` against
 * `ep-bold-rain-as6nh8m7.c-4.eu-central-1.aws.neon.tech`.
 *
 * Comparing raw hostnames therefore rejected the recommended setup as if the
 * two URLs named different databases, and every Vercel build died at
 * `prisma generate`.
 *
 * What the guard means to detect is two different *databases*. For a Neon host
 * the endpoint id in the first label is that identity, and it is the only part
 * worth comparing: the labels after it also differ between spellings of the
 * same endpoint — `c-4` appears on some and not on others — so comparing the
 * whole hostname would still refuse a legitimate pair.
 *
 * Anything that is not a Neon endpoint is compared whole, unchanged. Reducing
 * every host to its first label would make `db.example.com` and
 * `db.other.com` look like one database, which is the opposite of the point.
 */
function endpointIdentityOf(url: string | undefined): string | null {
  const host = hostOf(url);
  if (!host) return null;

  const [first] = host.split('.');
  if (!first.startsWith('ep-')) return host;

  return first.endsWith('-pooler') ? first.slice(0, -'-pooler'.length) : first;
}

export function resolveDatasourceUrl(input: {
  /** True only for a deliberate production deploy. */
  allowProtected: boolean;
  /** Local development default. Kept because localhost is never production. */
  fallback?: string;
  /** `DATABASE_URL` / `DIRECT_URL` as the process was invoked with them. */
  fromProcess: { DATABASE_URL?: string; DIRECT_URL?: string };
  /** The same two after any `.env` has been merged in. */
  merged: { DATABASE_URL?: string; DIRECT_URL?: string };
  protectedHosts: readonly string[];
}): string {
  const direct = input.merged.DIRECT_URL;
  const database = input.merged.DATABASE_URL;
  const chosen = direct ?? database;

  if (!chosen) {
    if (input.fallback) return input.fallback;
    throw new Error(
      [
        'Aucune base cible : ni DATABASE_URL ni DIRECT_URL.',
        'Passez par `pnpm db:target -- --url <chaîne> <verbe>`, qui nomme la',
        'cible explicitement.',
      ].join('\n'),
    );
  }

  const directHost = hostOf(direct);
  const databaseHost = hostOf(database);

  // The exact shape of the incident: the command named one database, a file
  // named another, and the file's value was the one that decided.
  const directCameFromFile =
    direct !== undefined && input.fromProcess.DIRECT_URL === undefined;
  const databaseCameFromCommand = input.fromProcess.DATABASE_URL !== undefined;

  if (directCameFromFile && databaseCameFromCommand) {
    throw new Error(
      [
        'Refus : DIRECT_URL vient d’un fichier .env, DATABASE_URL de la commande.',
        `  DIRECT_URL   → ${directHost ?? 'illisible'}  (fichier)`,
        `  DATABASE_URL → ${databaseHost ?? 'illisible'}  (commande)`,
        'DIRECT_URL déciderait, et ce n’est pas la base que vous avez nommée.',
        'C’est le mécanisme de l’incident du 30 août 2026 (V4.5-192).',
        'Retirez DIRECT_URL du .env, ou passez par `pnpm db:target`.',
      ].join('\n'),
    );
  }

  const directEndpoint = endpointIdentityOf(direct);
  const databaseEndpoint = endpointIdentityOf(database);

  if (
    directEndpoint &&
    databaseEndpoint &&
    directEndpoint !== databaseEndpoint
  ) {
    throw new Error(
      [
        'Refus : DATABASE_URL et DIRECT_URL désignent deux hôtes différents.',
        `  DIRECT_URL   → ${directHost}`,
        `  DATABASE_URL → ${databaseHost}`,
        'Il n’y a pas de bonne façon de choisir à votre place.',
      ].join('\n'),
    );
  }

  const chosenHost = hostOf(chosen);
  const blocked = input.protectedHosts.find(
    (entry) => chosenHost?.includes(entry) ?? false,
  );
  if (blocked && !input.allowProtected) {
    throw new Error(
      [
        `Refus : ${chosenHost} est un hôte protégé (quality/protected-db-hosts.json).`,
        'Un déploiement de production le fait délibérément, avec',
        'LEARNX_ALLOW_PROTECTED_DB=1. Rien d’autre ne devrait l’atteindre.',
      ].join('\n'),
    );
  }

  return chosen;
}
