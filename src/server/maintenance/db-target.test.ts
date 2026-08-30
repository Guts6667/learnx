import { planDbTarget } from './db-target';

const PROTECTED = ['ep-rapid-brook-asq9rq6r'];
const PREVIEW =
  'postgresql://user:secret@ep-quiet-meadow-123-pooler.eu-central-1.aws.neon.tech/neondb';
const PRODUCTION =
  'postgresql://user:secret@ep-rapid-brook-asq9rq6r-pooler.c-4.eu-central-1.aws.neon.tech/neondb';

function plan(overrides: Partial<Parameters<typeof planDbTarget>[0]> = {}) {
  return planDbTarget({
    confirmed: true,
    envFiles: [],
    protectedHosts: PROTECTED,
    url: PREVIEW,
    verb: 'migrate-deploy',
    ...overrides,
  });
}

describe('planDbTarget', () => {
  it('règle les deux variables depuis le seul nom donné', () => {
    const result = plan();

    // `prisma.config.ts` reads DIRECT_URL first. Setting only DATABASE_URL is
    // what let a command aimed at the preview reach production.
    expect(result).toMatchObject({
      env: { DATABASE_URL: PREVIEW, DIRECT_URL: PREVIEW },
      kind: 'PROCEED',
    });
  });

  it('refuse sans URL, sans jamais retomber sur l’environnement', () => {
    // An omitted target used to mean "whatever the shell happens to hold".
    expect(plan({ url: undefined })).toEqual({ kind: 'REFUSED_NO_URL' });
  });

  it('refuse un hôte protégé', () => {
    expect(plan({ url: PRODUCTION })).toMatchObject({
      kind: 'REFUSED_PROTECTED_HOST',
    });
  });

  it('refuse de tourner à côté d’un .env qui nomme un hôte protégé', () => {
    // The incident's actual mechanism was a file, not an argument. Refusing to
    // run beside it is stronger than out-ranking it: it does not depend on
    // which layer wins.
    const result = plan({
      envFiles: [
        { contents: `DIRECT_URL="${PRODUCTION}"\nAPP_URL="x"\n`, path: '.env' },
      ],
    });

    expect(result).toMatchObject({
      file: '.env',
      kind: 'REFUSED_ENV_NAMES_PROTECTED_HOST',
    });
  });

  it('laisse passer un .env qui ne nomme aucun hôte protégé', () => {
    const result = plan({
      envFiles: [{ contents: `DIRECT_URL="${PREVIEW}"\n`, path: '.env' }],
    });

    expect(result).toMatchObject({ kind: 'PROCEED' });
  });

  it('exige une confirmation explicite pour un verbe destructeur', () => {
    expect(plan({ confirmed: false, verb: 'execute' })).toMatchObject({
      kind: 'REFUSED_CONFIRMATION_REQUIRED',
      verb: 'execute',
    });
    expect(plan({ confirmed: false, verb: 'migrate-deploy' })).toMatchObject({
      kind: 'REFUSED_CONFIRMATION_REQUIRED',
    });
  });

  it('n’exige pas de confirmation pour un semis, qui a sa propre garde', () => {
    // `seed-preview` refuses any database holding an account.
    expect(plan({ confirmed: false, verb: 'seed-preview' })).toMatchObject({
      kind: 'PROCEED',
    });
  });

  it('refuse un verbe inconnu plutôt que de deviner', () => {
    expect(plan({ verb: 'drop-everything' })).toEqual({
      kind: 'REFUSED_UNKNOWN_VERB',
      verb: 'drop-everything',
    });
  });

  it('refuse une chaîne de connexion illisible', () => {
    expect(plan({ url: 'not a url' })).toEqual({
      kind: 'REFUSED_UNPARSEABLE_URL',
    });
  });

  it('expose l’hôte et la base pour qu’ils soient affichés avant d’agir', () => {
    const result = plan();

    expect(result).toMatchObject({
      database: 'neondb',
      host: 'ep-quiet-meadow-123-pooler.eu-central-1.aws.neon.tech',
    });
  });
});
