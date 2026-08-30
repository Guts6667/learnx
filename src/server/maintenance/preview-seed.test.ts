import {
  PREVIEW_ACCOUNT_EMAIL,
  PREVIEW_PACK_KEY,
  seedPreview,
  type PreviewSeedPorts,
} from './preview-seed';

function createPorts(overrides: Partial<PreviewSeedPorts> = {}) {
  const created: { users: unknown[]; packs: unknown[] } = {
    packs: [],
    users: [],
  };

  const ports: PreviewSeedPorts = {
    countUsers: async () => 0,
    createPack: async (input) => {
      created.packs.push(input);
      return { key: input.key };
    },
    createUser: async (input) => {
      created.users.push(input);
      return { id: 'user-1' };
    },
    hashPassword: async (password) => `argon2:${password}`,
    ...overrides,
  };

  return { created, ports };
}

const PASSWORD = 'un-mot-de-passe-de-preversion';

describe('seedPreview', () => {
  it('crée un compte et un pack actif sur une base vide', async () => {
    const { created, ports } = createPorts();

    const result = await seedPreview({
      nodeEnv: 'development',
      password: PASSWORD,
      ports,
    });

    expect(result).toEqual({
      email: PREVIEW_ACCOUNT_EMAIL,
      kind: 'SEEDED',
      packKey: PREVIEW_PACK_KEY,
      userId: 'user-1',
    });
    expect(created.users).toEqual([
      {
        displayName: 'Compte de préversion',
        email: PREVIEW_ACCOUNT_EMAIL,
        passwordHash: `argon2:${PASSWORD}`,
      },
    ]);
    // Asserted in full rather than partially: `active: false` would make the
    // pack invisible to checkout, which is the whole reason this account
    // exists, and a wrong price or credit count would be discovered only by a
    // human reading a Stripe receipt during the pass.
    expect(created.packs).toEqual([
      {
        active: true,
        credits: 10n,
        currency: 'EUR',
        key: 'preview-placeholder',
        label: 'Pack de préversion',
        priceMinor: 100n,
      },
    ]);
  });

  it('refuse une base qui contient déjà un compte', async () => {
    const { created, ports } = createPorts({ countUsers: async () => 1 });

    const result = await seedPreview({
      nodeEnv: 'development',
      password: PASSWORD,
      ports,
    });

    // This is the guard that makes the script safe to hand to someone whose
    // shell may be pointed anywhere: production is never empty.
    expect(result).toEqual({ kind: 'REFUSED_DATABASE_NOT_EMPTY', users: 1 });
    expect(created.users).toEqual([]);
    expect(created.packs).toEqual([]);
  });

  it('refuse en production sans même interroger la base', async () => {
    let queried = false;
    const { created, ports } = createPorts({
      countUsers: async () => {
        queried = true;
        return 0;
      },
    });

    const result = await seedPreview({
      nodeEnv: 'production',
      password: PASSWORD,
      ports,
    });

    expect(result).toEqual({ kind: 'REFUSED_PRODUCTION' });
    expect(queried).toBe(false);
    expect(created.users).toEqual([]);
  });

  it('refuse un mot de passe absent', async () => {
    const { created, ports } = createPorts();

    const result = await seedPreview({
      nodeEnv: 'development',
      password: undefined,
      ports,
    });

    expect(result).toEqual({ kind: 'REFUSED_PASSWORD_MISSING' });
    expect(created.users).toEqual([]);
  });

  it('refuse un mot de passe que la connexion rejetterait', async () => {
    const { created, ports } = createPorts();

    // `auth-validation.ts` requires twelve characters. Eleven would seed an
    // account the login endpoint then refuses as invalid input — usable by
    // nobody, and confusing to diagnose.
    const result = await seedPreview({
      nodeEnv: 'development',
      password: 'onze-carac',
      ports,
    });

    expect(result).toEqual({ kind: 'REFUSED_PASSWORD_TOO_SHORT' });
    expect(created.users).toEqual([]);
  });

  it('refuse un mot de passe au-delà de la limite de la connexion', async () => {
    const { created, ports } = createPorts();

    const result = await seedPreview({
      nodeEnv: 'development',
      password: 'a'.repeat(129),
      ports,
    });

    expect(result).toEqual({ kind: 'REFUSED_PASSWORD_TOO_LONG' });
    expect(created.users).toEqual([]);
  });

  it('ne crée jamais le pack si le compte échoue', async () => {
    const { created, ports } = createPorts({
      createUser: async () => {
        throw new Error('insert failed');
      },
    });

    await expect(
      seedPreview({ nodeEnv: 'development', password: PASSWORD, ports }),
    ).rejects.toThrow('insert failed');
    // The caller runs both in one transaction; this pins the ordering the
    // transaction relies on, so a half-seeded database cannot be reached by
    // rerunning against the emptiness guard.
    expect(created.packs).toEqual([]);
  });
});
