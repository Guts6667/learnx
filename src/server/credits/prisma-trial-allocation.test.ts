import { createPrismaTrialAllocation } from './prisma-trial-allocation';

const USER_ID = '6ce94140-7435-426a-9753-90faebc7695a';
const NOW = new Date('2026-03-15T12:00:00Z');

function build(
  options: {
    breakerOpen?: boolean;
    cohort?: string | null;
    existingCycle?: unknown;
    policies?: unknown[];
  } = {},
) {
  const grants: { amount: bigint; idempotencyKey: string }[] = [];
  const upserts: Record<string, unknown>[] = [];
  const client = {
    creditAccount: {
      findFirstOrThrow: vi.fn(async () => ({ id: 'account-1' })),
    },
    creditAllocationPolicyVersion: {
      findMany: vi.fn(
        async () =>
          options.policies ?? [
            { allocationAmount: 100n, cohort: null, id: 'policy-general' },
          ],
      ),
    },
    creditGrantCycle: {
      findUnique: vi.fn(async () => options.existingCycle ?? null),
      upsert: vi.fn(async (input: { create: Record<string, unknown> }) => {
        upserts.push(input.create);
        return {};
      }),
    },
    user: {
      findUnique: vi.fn(async () =>
        options.cohort === null ? null : { cohort: options.cohort ?? 'TRIAL' },
      ),
    },
  };
  const service = createPrismaTrialAllocation(client as never, {
    breakerIsOpen: vi.fn(async () => options.breakerOpen ?? false),
    grant: vi.fn(async (input: { amount: bigint; idempotencyKey: string }) => {
      grants.push(input);
      return { lotId: 'lot-1' };
    }),
    now: () => NOW,
  });
  return { client, grants, service, upserts };
}

describe('allocation d’essai mensuelle', () => {
  it('verse la politique de la cohorte et estampille celle-ci', async () => {
    const { service, upserts } = build({
      cohort: 'TRIAL',
      policies: [
        { allocationAmount: 100n, cohort: null, id: 'policy-general' },
        { allocationAmount: 500n, cohort: 'TRIAL', id: 'policy-trial' },
      ],
    });

    await expect(service.grantForCycle(USER_ID)).resolves.toEqual({
      amount: 500n,
      cycleKey: '2026-03',
      kind: 'GRANTED',
    });
    // Stamped rather than joined: correcting a cohort later must not rewrite
    // what was already granted under the old one.
    expect(upserts[0]).toMatchObject({ cohort: 'TRIAL', cycleKey: '2026-03' });
  });

  it('dérive une clé d’idempotence stable pour le cycle', async () => {
    // This key is where the no-double-grant guarantee lives: grantCredits is
    // idempotent on it inside the account lock, so two concurrent calls for
    // one cycle produce one lot whichever wins.
    const { grants, service } = build();
    await service.grantForCycle(USER_ID);
    expect(grants[0]?.idempotencyKey).toBe(
      `trial:policy-general:2026-03:${USER_ID}`,
    );
  });

  it('ne verse rien deux fois dans le même cycle', async () => {
    const { grants, service } = build({ existingCycle: { id: 'cycle-1' } });
    await expect(service.grantForCycle(USER_ID)).resolves.toEqual({
      cycleKey: '2026-03',
      kind: 'ALREADY_GRANTED',
    });
    expect(grants).toEqual([]);
  });

  it('ne verse rien quand le coupe-circuit est ouvert', async () => {
    // A grant is a promise the feature will run. An open breaker is the
    // statement that it will not.
    const { grants, service } = build({ breakerOpen: true });
    await expect(service.grantForCycle(USER_ID)).resolves.toEqual({
      cycleKey: '2026-03',
      kind: 'SUSPENDED',
    });
    expect(grants).toEqual([]);
  });

  it('consulte le coupe-circuit avant de créditer, pas après', async () => {
    const { grants, service } = build({ breakerOpen: true });
    await service.grantForCycle(USER_ID);
    expect(grants).toEqual([]);
  });

  it('ne rattrape jamais un cycle manqué', async () => {
    // A learner who missed a cycle gets the next one, not two: the key names
    // the current cycle only, so nothing can accumulate.
    const { grants, service } = build();
    await service.grantForCycle(USER_ID);
    expect(grants).toHaveLength(1);
    expect(grants[0]?.idempotencyKey).toContain('2026-03');
  });

  it('ne verse rien sans politique servant la cohorte', async () => {
    const { grants, service } = build({
      cohort: 'EARLY_ADOPTER',
      policies: [
        { allocationAmount: 500n, cohort: 'TRIAL', id: 'policy-trial' },
      ],
    });
    await expect(service.grantForCycle(USER_ID)).resolves.toMatchObject({
      kind: 'NO_POLICY',
    });
    expect(grants).toEqual([]);
  });
});

describe('anti-abus des allocations d’essai', () => {
  function withMarker(options: { address?: string | null; marker?: unknown }) {
    const lookedUp: string[] = [];
    const upserted: Record<string, unknown>[] = [];
    const grants: { idempotencyKey: string }[] = [];
    const client = {
      creditAccount: {
        findFirstOrThrow: vi.fn(async () => ({ id: 'account-1' })),
      },
      creditAllocationPolicyVersion: {
        findMany: vi.fn(async () => [
          { allocationAmount: 100n, cohort: null, id: 'policy-general' },
        ]),
      },
      creditGrantCycle: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      trialAllocationMarker: {
        findUnique: vi.fn(async (input: { where: { keyHash: string } }) => {
          lookedUp.push(input.where.keyHash);
          return options.marker ?? null;
        }),
        upsert: vi.fn(async (input: Record<string, unknown>) => {
          upserted.push(input);
          return {};
        }),
      },
      user: { findUnique: vi.fn(async () => ({ cohort: 'TRIAL' })) },
    };
    const service = createPrismaTrialAllocation(client as never, {
      breakerIsOpen: vi.fn(async () => false),
      clientAddress:
        options.address === undefined ? '203.0.113.7' : options.address,
      grant: vi.fn(async (input: { idempotencyKey: string }) => {
        grants.push(input);
        return { lotId: 'lot-1' };
      }),
      now: () => NOW,
    });
    return { client, grants, lookedUp, service, upserted };
  }

  it('compte le versement sous une empreinte, jamais sous l’adresse', async () => {
    const { lookedUp, service } = withMarker({});
    await service.grantForCycle(USER_ID);
    const key = lookedUp[0] ?? '';
    // Without the server secret the row identifies nobody; the address itself
    // never reaches the database.
    expect(key).not.toContain('203.0.113.7');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuse au plafond sans rien créditer', async () => {
    const { grants, service } = withMarker({
      marker: {
        firstSeenAt: new Date('2026-01-01T00:00:00Z'),
        grants: 3,
        lastSeenAt: new Date('2026-01-02T00:00:00Z'),
      },
    });
    await expect(service.grantForCycle(USER_ID)).resolves.toEqual({
      cycleKey: '2026-03',
      kind: 'REFUSED',
      verdict: 'CAP_REACHED',
    });
    expect(grants).toEqual([]);
  });

  it('ne consomme l’allocation qu’après un versement réussi', async () => {
    // A refusal upstream must never spend an allowance the learner did not
    // receive.
    const { service, upserted } = withMarker({});
    await service.grantForCycle(USER_ID);
    expect(upserted).toHaveLength(1);

    const refused = withMarker({
      marker: {
        firstSeenAt: new Date('2026-01-01T00:00:00Z'),
        grants: 3,
        lastSeenAt: new Date('2026-01-02T00:00:00Z'),
      },
    });
    await refused.service.grantForCycle(USER_ID);
    expect(refused.upserted).toEqual([]);
  });

  it('verse quand aucune adresse n’est attribuable', async () => {
    // Refusing every grant we cannot attribute would punish learners for a
    // proxy's behaviour.
    const { client, grants, service } = withMarker({ address: null });
    await service.grantForCycle(USER_ID);
    expect(grants).toHaveLength(1);
    expect(client.trialAllocationMarker.findUnique).not.toHaveBeenCalled();
  });
});
