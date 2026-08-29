import {
  PrismaCorrectionBreaker,
  observeCorrections,
} from './correction-breaker';

function correction(overrides: Record<string, unknown> = {}) {
  return {
    criterionFeedback: [],
    structuredResult: {
      correction: {
        criteria: [{ confidence: 'HIGH', key: 'decision-position' }],
        monitoringSignals: [],
        status: 'COMPLETED',
      },
    },
    ...overrides,
  };
}

function breaker(options: {
  corrections?: unknown[];
  latest?: unknown;
  onFindMany?: () => never;
}) {
  const create = vi.fn(async () => ({
    createdAt: new Date('2026-08-29T12:00:00.000Z'),
  }));
  const prisma = {
    aiCorrection: {
      findMany: vi.fn(async () => {
        if (options.onFindMany) options.onFindMany();
        return options.corrections ?? [];
      }),
    },
    aiCorrectionBreakerEvent: {
      create,
      findFirst: vi.fn(async () => options.latest ?? null),
    },
  };
  return { create, breaker: new PrismaCorrectionBreaker(prisma as never) };
}

describe('observeCorrections', () => {
  it('ne compte que les critères étiquetés HIGH dans la règle apprenant', () => {
    // The claim being tested is the strongest one the interface makes. A vote
    // against a MEDIUM criterion contradicts nothing we asserted.
    const observed = observeCorrections([
      correction({
        criterionFeedback: [
          { criterionKey: 'decision-position', verdict: 'WRONG' },
        ],
      }),
      correction({
        criterionFeedback: [
          { criterionKey: 'evidence-selection', verdict: 'WRONG' },
        ],
        structuredResult: {
          correction: {
            criteria: [{ confidence: 'MEDIUM', key: 'evidence-selection' }],
            status: 'COMPLETED',
          },
        },
      }),
    ]);
    expect(observed.highCriteriaVoted).toBe(1);
    expect(observed.highCriteriaVotedWrong).toBe(1);
  });

  it('compte les désaccords du vérificateur et les corrections inutilisables', () => {
    const observed = observeCorrections([
      correction({
        structuredResult: {
          correction: {
            criteria: [],
            monitoringSignals: ['CHECKER_DISAGREED'],
            status: 'COMPLETED_PARTIAL',
          },
        },
      }),
      correction({
        structuredResult: { correction: { criteria: [], status: 'FAILED' } },
      }),
    ]);
    expect(observed).toMatchObject({
      checkerDisagreed: 1,
      unusable: 1,
      windowObserved: 2,
    });
  });
});

describe('PrismaCorrectionBreaker', () => {
  it('reste fermé quand rien ne franchit', async () => {
    const { breaker: service, create } = breaker({
      corrections: Array.from({ length: 50 }, () => correction()),
    });
    await expect(service.evaluate()).resolves.toMatchObject({
      reason: null,
      state: 'CLOSED',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('déclenche et enregistre la cause, le taux et le seuil', async () => {
    const { breaker: service, create } = breaker({
      corrections: Array.from({ length: 50 }, (_, index) =>
        correction({
          structuredResult: {
            correction: {
              criteria: [],
              monitoringSignals: index < 30 ? ['CHECKER_DISAGREED'] : [],
              status: 'COMPLETED',
            },
          },
        }),
      ),
    });
    await expect(service.evaluate()).resolves.toMatchObject({
      reason: 'CHECKER_DISAGREEMENT',
      state: 'OPEN',
      trippedAt: '2026-08-29T12:00:00.000Z',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'TRIPPED',
          rate: 0.6,
          reason: 'CHECKER_DISAGREEMENT',
          threshold: 0.4,
          windowSize: 50,
        }),
      }),
    );
  });

  it('reste ouvert une fois verrouillé, sans rien remesurer', async () => {
    // Latching is the point: a rate dipping back under the line must not
    // quietly resume corrections and erase the incident.
    const { breaker: service, create } = breaker({
      corrections: Array.from({ length: 50 }, () => correction()),
      latest: {
        action: 'TRIPPED',
        createdAt: new Date('2026-08-29T11:00:00.000Z'),
        reason: 'UNUSABLE_RATE',
      },
    });
    await expect(service.evaluate()).resolves.toMatchObject({
      reason: 'UNUSABLE_RATE',
      state: 'OPEN',
      trippedAt: '2026-08-29T11:00:00.000Z',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('se referme uniquement sur une réouverture écrite', async () => {
    const { breaker: service } = breaker({
      latest: {
        action: 'REOPENED',
        createdAt: new Date('2026-08-29T11:30:00.000Z'),
        reason: null,
      },
    });
    await expect(service.status()).resolves.toMatchObject({ state: 'CLOSED' });
  });

  it('reste fermé et signale son aveuglement quand il ne peut pas mesurer', async () => {
    // The opposite of the checker's rule, and deliberately so: a checker
    // failure costs a confidence ceiling, a breaker failing open would cost
    // the product against a rate that moves over hours.
    const { breaker: service, create } = breaker({
      onFindMany: () => {
        throw new Error('connection terminated');
      },
    });
    await expect(service.evaluate()).resolves.toMatchObject({
      evaluationError: 'connection terminated',
      state: 'CLOSED',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('enregistre qui a rouvert', async () => {
    const { breaker: service, create } = breaker({});
    await service.reopen({ actorId: 'admin-1', note: 'fournisseur rétabli' });
    expect(create).toHaveBeenCalledWith({
      data: {
        action: 'REOPENED',
        actorId: 'admin-1',
        note: 'fournisseur rétabli',
      },
    });
  });
});
