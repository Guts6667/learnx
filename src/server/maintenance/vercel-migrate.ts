/**
 * Decides whether a Vercel build applies migrations (V4.5-200).
 *
 * Until now only production migrated. That was right when it was written — it
 * stopped every preview build from migrating a shared database — but it left a
 * gap: the `preview` Neon branch drifts behind the schema, and on 30 August
 * 2026 a Stripe retry answered 500 because migration 195 had never reached it.
 * The column existed in the repository and not in the database the preview was
 * talking to.
 *
 * So one more case migrates: a preview build **of `dev`**. `dev` is the only
 * ref whose preview points at the shared `preview` branch; a feature branch
 * must never migrate it, because two feature branches carrying different
 * migrations would apply them to the same database in whichever order they
 * happened to build.
 *
 * Both conditions are required. `VERCEL_ENV` alone would let a production
 * deployment built from `dev` take the preview path the day someone changes the
 * production branch, and `VERCEL_GIT_COMMIT_REF` alone would migrate from any
 * environment that happened to be on `dev`.
 */

export type MigrationPlan =
  | { kind: 'MIGRATE'; reason: string }
  | { kind: 'REFUSED_ENV_FILE'; file: string }
  | { kind: 'SKIP'; reason: string };

export interface MigrationInputs {
  /** Existing dotenv-style files in the working directory. */
  envFiles: readonly string[];
  /** The ref whose preview owns the shared preview database. */
  previewRef: string;
  /** `VERCEL_GIT_COMMIT_REF`. */
  ref: string | undefined;
  /** `VERCEL_ENV`: production, preview, development, or unset. */
  vercelEnv: string | undefined;
}

export function planVercelMigration(input: MigrationInputs): MigrationPlan {
  // Checked before anything else, including production. `prisma.config.ts`
  // resolves DIRECT_URL before DATABASE_URL, so a file sitting next to the
  // command can decide the target while the command appears to name it. That
  // is exactly how production was emptied on 30 August 2026 (V4.5-192). A
  // Vercel build never has one of these files, so this costs nothing there and
  // protects anyone who runs the script by hand.
  const [envFile] = input.envFiles;
  if (envFile) return { kind: 'REFUSED_ENV_FILE', file: envFile };

  if (input.vercelEnv === 'production') {
    return { kind: 'MIGRATE', reason: 'production deployment' };
  }

  if (input.vercelEnv === 'preview' && input.ref === input.previewRef) {
    return {
      kind: 'MIGRATE',
      reason: `preview deployment of ${input.previewRef}`,
    };
  }

  return {
    kind: 'SKIP',
    reason:
      `VERCEL_ENV=${input.vercelEnv ?? 'unset'}, ` +
      `VERCEL_GIT_COMMIT_REF=${input.ref ?? 'unset'}`,
  };
}
