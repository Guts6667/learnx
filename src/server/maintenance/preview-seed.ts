/**
 * Seeds a preview database with the minimum needed to run the Stripe sandbox
 * pass: one account to log in with, one active pack to buy.
 *
 * The preview database is created empty and seeded — never branched from
 * production, because a Neon branch clones data and that would put real
 * learner text and payment records into an environment reachable by preview
 * URL (`docs/V4_5_RGPD_AUDIT.md` §2–§3, finding E4).
 *
 * That intent is enforced here rather than trusted: this refuses to run
 * against any database that already holds an account. It cannot seed
 * production, and it cannot seed a populated branch, whatever `DATABASE_URL`
 * happens to point at when someone runs it.
 */

/** Matches `auth-validation.ts`: a shorter password would be seeded fine and */
/** then rejected by the login endpoint, leaving an account nobody can use. */
const PREVIEW_PASSWORD_MIN_LENGTH = 12;
const PREVIEW_PASSWORD_MAX_LENGTH = 128;

export const PREVIEW_ACCOUNT_EMAIL = 'preview-test@learn-x.app';
export const PREVIEW_PACK_KEY = 'preview-placeholder';

/** One euro. Small enough to be unremarkable on a real card statement if the */
/** sandbox is ever pointed at live keys by mistake. */
const PREVIEW_PACK_PRICE_MINOR = 100n;
const PREVIEW_PACK_CREDITS = 10n;
const PREVIEW_PACK_CURRENCY = 'EUR';

export type PreviewSeedPorts = {
  /** Counts accounts. Anything above zero stops the run. */
  countUsers: () => Promise<number>;
  createUser: (input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }) => Promise<{ id: string }>;
  createPack: (input: {
    key: string;
    label: string;
    credits: bigint;
    priceMinor: bigint;
    currency: string;
    active: boolean;
  }) => Promise<{ key: string }>;
  hashPassword: (password: string) => Promise<string>;
};

export type PreviewSeedResult =
  | { kind: 'SEEDED'; userId: string; email: string; packKey: string }
  | { kind: 'REFUSED_PRODUCTION' }
  | { kind: 'REFUSED_DATABASE_NOT_EMPTY'; users: number }
  | { kind: 'REFUSED_PASSWORD_MISSING' }
  | { kind: 'REFUSED_PASSWORD_TOO_SHORT' }
  | { kind: 'REFUSED_PASSWORD_TOO_LONG' };

export async function seedPreview(input: {
  ports: PreviewSeedPorts;
  nodeEnv: string | undefined;
  password: string | undefined;
}): Promise<PreviewSeedResult> {
  // Checked first and separately from the emptiness guard: on Vercel,
  // NODE_ENV is 'production' on preview deployments too, so this catches a
  // run from a production-configured shell before any query is made.
  if (input.nodeEnv === 'production') {
    return { kind: 'REFUSED_PRODUCTION' };
  }

  if (!input.password) return { kind: 'REFUSED_PASSWORD_MISSING' };
  if (input.password.length < PREVIEW_PASSWORD_MIN_LENGTH) {
    return { kind: 'REFUSED_PASSWORD_TOO_SHORT' };
  }
  if (input.password.length > PREVIEW_PASSWORD_MAX_LENGTH) {
    return { kind: 'REFUSED_PASSWORD_TOO_LONG' };
  }

  const users = await input.ports.countUsers();
  if (users > 0) return { kind: 'REFUSED_DATABASE_NOT_EMPTY', users };

  const passwordHash = await input.ports.hashPassword(input.password);
  const user = await input.ports.createUser({
    displayName: 'Compte de préversion',
    email: PREVIEW_ACCOUNT_EMAIL,
    passwordHash,
  });
  const pack = await input.ports.createPack({
    active: true,
    credits: PREVIEW_PACK_CREDITS,
    currency: PREVIEW_PACK_CURRENCY,
    key: PREVIEW_PACK_KEY,
    label: 'Pack de préversion',
    priceMinor: PREVIEW_PACK_PRICE_MINOR,
  });

  return {
    email: PREVIEW_ACCOUNT_EMAIL,
    kind: 'SEEDED',
    packKey: pack.key,
    userId: user.id,
  };
}
