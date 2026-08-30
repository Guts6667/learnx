/**
 * Decides whether a database command may run, and against what (V4.5-192).
 *
 * Production was emptied on 30 August 2026 by a command aimed at the preview
 * branch. `prisma.config.ts` resolves `DIRECT_URL ?? DATABASE_URL`; a worktree
 * `.env` set `DIRECT_URL` to production; the connection string passed on the
 * command line set only `DATABASE_URL`. The command was correct, the target
 * was not, and nothing in between said so. It was recovered by point-in-time
 * restore.
 *
 * So the rule is no longer "pass the right URL". It is that a database
 * command names its target explicitly, that both variables come from that one
 * name, that no `.env` can contribute, and that the host is shown before
 * anything happens.
 */

type DbTargetVerb = 'execute' | 'migrate-deploy' | 'seed-preview';

/** Verbs that can destroy or rewrite data, and so need `--yes`. */
const DESTRUCTIVE: readonly DbTargetVerb[] = ['execute', 'migrate-deploy'];

const VERBS: readonly DbTargetVerb[] = [
  'execute',
  'migrate-deploy',
  'seed-preview',
];

export type DbTargetPlan =
  | {
      database: string;
      env: { DATABASE_URL: string; DIRECT_URL: string };
      host: string;
      kind: 'PROCEED';
      verb: DbTargetVerb;
    }
  | { kind: 'REFUSED_CONFIRMATION_REQUIRED'; host: string; verb: DbTargetVerb }
  | { kind: 'REFUSED_ENV_NAMES_PROTECTED_HOST'; file: string; host: string }
  | { kind: 'REFUSED_NO_URL' }
  | { kind: 'REFUSED_PROTECTED_HOST'; host: string }
  | { kind: 'REFUSED_UNKNOWN_VERB'; verb: string }
  | { kind: 'REFUSED_UNPARSEABLE_URL' };

function hostOf(url: string): { database: string; host: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;

    return {
      database: parsed.pathname.replace(/^\//, ''),
      host: parsed.hostname,
    };
  } catch {
    return null;
  }
}

function protectedMatch(
  host: string,
  protectedHosts: readonly string[],
): string | null {
  return protectedHosts.find((entry) => host.includes(entry)) ?? null;
}

export function planDbTarget(input: {
  confirmed: boolean;
  /**
   * Every `.env` in scope, read by the caller. Checked as well as ignored:
   * relying on environment precedence is what failed, and a file that names a
   * protected host is a trap whether or not this run would have sprung it.
   */
  envFiles: readonly { contents: string; path: string }[];
  protectedHosts: readonly string[];
  url: string | undefined;
  verb: string;
}): DbTargetPlan {
  if (!VERBS.includes(input.verb as DbTargetVerb)) {
    return { kind: 'REFUSED_UNKNOWN_VERB', verb: input.verb };
  }
  const verb = input.verb as DbTargetVerb;

  // No fallback to the environment, deliberately. An omitted `--url` used to
  // mean "whatever the shell happens to hold", which is how a command reaches
  // a database nobody named.
  if (!input.url) return { kind: 'REFUSED_NO_URL' };

  const target = hostOf(input.url);
  if (!target) return { kind: 'REFUSED_UNPARSEABLE_URL' };

  const blocked = protectedMatch(target.host, input.protectedHosts);
  if (blocked) return { kind: 'REFUSED_PROTECTED_HOST', host: target.host };

  for (const file of input.envFiles) {
    for (const line of file.contents.split('\n')) {
      const named = protectedMatch(line, input.protectedHosts);
      if (named) {
        // The incident's actual mechanism: a file, not an argument. Refusing
        // to run beside it is stronger than out-ranking it, because it does
        // not depend on which layer wins.
        return {
          file: file.path,
          host: named,
          kind: 'REFUSED_ENV_NAMES_PROTECTED_HOST',
        };
      }
    }
  }

  if (DESTRUCTIVE.includes(verb) && !input.confirmed) {
    return { host: target.host, kind: 'REFUSED_CONFIRMATION_REQUIRED', verb };
  }

  return {
    database: target.database,
    // Both, from the one name. `prisma.config.ts` reads DIRECT_URL first, so
    // setting only DATABASE_URL leaves the real target to whatever else is
    // lying around.
    env: { DATABASE_URL: input.url, DIRECT_URL: input.url },
    host: target.host,
    kind: 'PROCEED',
    verb,
  };
}
