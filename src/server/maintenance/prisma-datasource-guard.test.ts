import { resolveDatasourceUrl } from './prisma-datasource-guard';

const PROTECTED = ['ep-rapid-brook-asq9rq6r'];
const PRODUCTION =
  'postgresql://u:p@ep-rapid-brook-asq9rq6r-pooler.c-4.eu-central-1.aws.neon.tech/neondb';
const PREVIEW =
  'postgresql://u:p@ep-bold-rain-as6nh8m7.eu-central-1.aws.neon.tech/neondb';

function resolve(
  overrides: Partial<Parameters<typeof resolveDatasourceUrl>[0]>,
) {
  return resolveDatasourceUrl({
    allowProtected: false,
    fromProcess: {},
    merged: {},
    protectedHosts: PROTECTED,
    ...overrides,
  });
}

describe('resolveDatasourceUrl', () => {
  it('rejoue l’incident du 30 août et refuse', () => {
    // The command named the preview; a worktree .env named production; the
    // file's value was the one that decided.
    expect(() =>
      resolve({
        fromProcess: { DATABASE_URL: PREVIEW },
        merged: { DATABASE_URL: PREVIEW, DIRECT_URL: PRODUCTION },
      }),
    ).toThrow(/DIRECT_URL vient d’un fichier/);
  });

  it('nomme les deux hôtes dans le refus', () => {
    // The failure was never that a wrong value existed. It was that nobody
    // could see which value was in use.
    try {
      resolve({
        fromProcess: { DATABASE_URL: PREVIEW },
        merged: { DATABASE_URL: PREVIEW, DIRECT_URL: PRODUCTION },
      });
      expect.unreachable('should have refused');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('ep-rapid-brook-asq9rq6r');
      expect(message).toContain('ep-bold-rain-as6nh8m7');
    }
  });

  it('refuse deux hôtes différents quelle que soit leur provenance', () => {
    expect(() =>
      resolve({
        fromProcess: { DATABASE_URL: PREVIEW, DIRECT_URL: PRODUCTION },
        merged: { DATABASE_URL: PREVIEW, DIRECT_URL: PRODUCTION },
      }),
    ).toThrow(/deux hôtes différents/);
  });

  it('refuse un hôte protégé sans autorisation explicite', () => {
    expect(() =>
      resolve({
        fromProcess: { DATABASE_URL: PRODUCTION, DIRECT_URL: PRODUCTION },
        merged: { DATABASE_URL: PRODUCTION, DIRECT_URL: PRODUCTION },
      }),
    ).toThrow(/hôte protégé/);
  });

  it('laisse un déploiement de production passer délibérément', () => {
    // `vercel:migrate` runs `prisma migrate deploy` when VERCEL_ENV=production.
    // Without this door, the guard protecting production would also stop
    // production from migrating.
    expect(
      resolve({
        allowProtected: true,
        fromProcess: { DATABASE_URL: PRODUCTION, DIRECT_URL: PRODUCTION },
        merged: { DATABASE_URL: PRODUCTION, DIRECT_URL: PRODUCTION },
      }),
    ).toBe(PRODUCTION);
  });

  it('accepte les deux variables d’accord sur un hôte non protégé', () => {
    expect(
      resolve({
        fromProcess: { DATABASE_URL: PREVIEW, DIRECT_URL: PREVIEW },
        merged: { DATABASE_URL: PREVIEW, DIRECT_URL: PREVIEW },
      }),
    ).toBe(PREVIEW);
  });

  it('accepte DIRECT_URL seul quand il vient de la commande', () => {
    expect(
      resolve({
        fromProcess: { DIRECT_URL: PREVIEW },
        merged: { DIRECT_URL: PREVIEW },
      }),
    ).toBe(PREVIEW);
  });

  it('accepte un .env cohérent quand rien ne vient de la commande', () => {
    // A developer with one .env pointing at their own database is not the
    // failure mode; two sources disagreeing is.
    expect(
      resolve({ merged: { DATABASE_URL: PREVIEW, DIRECT_URL: PREVIEW } }),
    ).toBe(PREVIEW);
  });

  it('refuse quand aucune cible n’est donnée et qu’il n’y a pas de repli', () => {
    expect(() => resolve({})).toThrow(/Aucune base cible/);
  });

  it('garde le repli local, qui n’est jamais la production', () => {
    // A developer with no .env still gets their localhost database. Removing
    // that would be scope creep, and localhost cannot be the failure this
    // guard exists for.
    const localhost = 'postgresql://learnx:learnx@localhost:5432/learnx';

    expect(resolve({ fallback: localhost })).toBe(localhost);
  });
});
