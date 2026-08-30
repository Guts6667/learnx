import { planVercelMigration } from './vercel-migrate';

function plan(overrides: Partial<Parameters<typeof planVercelMigration>[0]>) {
  return planVercelMigration({
    envFiles: [],
    previewRef: 'dev',
    ref: undefined,
    vercelEnv: undefined,
    ...overrides,
  });
}

describe('planVercelMigration', () => {
  it('migre en production, quelle que soit la branche', () => {
    // Production must never depend on branch-name matching.
    expect(plan({ ref: 'anything', vercelEnv: 'production' })).toEqual({
      kind: 'MIGRATE',
      reason: 'production deployment',
    });
  });

  it('migre sur le preview de dev, qui possède la base partagée', () => {
    // The gap this ticket closes: migration 195 never reached the `preview`
    // Neon branch, and a Stripe retry answered 500.
    expect(plan({ ref: 'dev', vercelEnv: 'preview' })).toEqual({
      kind: 'MIGRATE',
      reason: 'preview deployment of dev',
    });
  });

  it('ne migre pas depuis une branche de travail', () => {
    // Two feature branches carrying different migrations would apply them to
    // the same database in whichever order they happened to build.
    expect(plan({ ref: 'codex/v4-5-193', vercelEnv: 'preview' }).kind).toBe(
      'SKIP',
    );
  });

  it('exige les deux conditions, pas l’une ou l’autre', () => {
    // VERCEL_ENV alone would let a production deployment built from dev take
    // the preview path the day someone changes the production branch.
    expect(plan({ ref: 'dev', vercelEnv: 'development' }).kind).toBe('SKIP');
    // And the ref alone would migrate from any environment sitting on dev.
    expect(plan({ ref: undefined, vercelEnv: 'preview' }).kind).toBe('SKIP');
  });

  it('dit ce qu’il a vu quand il ignore', () => {
    // A skip that does not name its inputs is indistinguishable from a bug.
    expect(plan({ ref: 'feature', vercelEnv: 'preview' })).toEqual({
      kind: 'SKIP',
      reason: 'VERCEL_ENV=preview, VERCEL_GIT_COMMIT_REF=feature',
    });
  });

  it('nomme unset plutôt que rien, hors de Vercel', () => {
    expect(plan({})).toEqual({
      kind: 'SKIP',
      reason: 'VERCEL_ENV=unset, VERCEL_GIT_COMMIT_REF=unset',
    });
  });

  it('refuse à côté d’un .env, avant même la production', () => {
    // prisma.config.ts resolves DIRECT_URL before DATABASE_URL, so a file next
    // to the command can decide the target while the command appears to name
    // it. That is how production was emptied on 30 August 2026.
    expect(
      plan({ envFiles: ['.env'], ref: 'main', vercelEnv: 'production' }),
    ).toEqual({ kind: 'REFUSED_ENV_FILE', file: '.env' });
  });
});
