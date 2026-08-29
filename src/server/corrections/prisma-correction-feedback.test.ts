import { PrismaCorrectionFeedbackRepository } from './prisma-correction-feedback';

const CORRECTION_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';
const USER_ID = '6ce94140-7435-426a-9753-90faebc7695a';

function build(correction: unknown) {
  const upsert = vi.fn(async () => ({
    updatedAt: new Date('2026-08-29T10:00:00.000Z'),
  }));
  const findFirst = vi.fn(async () => correction);
  const prisma = {
    aiCorrection: { findFirst },
    aiCorrectionCriterionFeedback: { findMany: vi.fn(async () => []), upsert },
  };
  return {
    findFirst,
    repository: new PrismaCorrectionFeedbackRepository(prisma as never),
    upsert,
  };
}

const delivered = {
  structuredResult: {
    correction: {
      criteria: [{ key: 'decision-position' }, { key: 'evidence-selection' }],
    },
  },
};

function record(
  repository: PrismaCorrectionFeedbackRepository,
  criterionKey = 'decision-position',
) {
  return repository.record({
    correctionId: CORRECTION_ID,
    criterionKey,
    userId: USER_ID,
    verdict: 'WRONG',
  });
}

describe('PrismaCorrectionFeedbackRepository', () => {
  it('enregistre un verdict sur un critère réellement livré', async () => {
    const { repository, upsert } = build(delivered);
    await expect(record(repository)).resolves.toEqual({
      recordedAt: new Date('2026-08-29T10:00:00.000Z'),
      status: 'RECORDED',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('borne la correction à son propriétaire dans la requête', async () => {
    const { findFirst, repository } = build(delivered);
    await record(repository);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CORRECTION_ID, userId: USER_ID },
      }),
    );
  });

  it('n’écrit rien quand la correction n’est pas celle de l’apprenant', async () => {
    const { repository, upsert } = build(null);
    await expect(record(repository)).resolves.toEqual({ status: 'NOT_FOUND' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuse un critère que la correction n’a pas livré', async () => {
    // Otherwise a learner could write arbitrary keys into a signal we intend
    // to count, and the count would stop meaning anything.
    const { repository, upsert } = build(delivered);
    await expect(record(repository, 'critere-invente')).resolves.toEqual({
      status: 'UNKNOWN_CRITERION',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('accepte un critère « à retravailler »', async () => {
    // "You refused to judge this and you were wrong to" is the one signal no
    // machine oracle can produce, and it is what calibrates where the LOW
    // boundary should sit. An unsure criterion was shown to the learner, so it
    // is theirs to answer on.
    const { repository, upsert } = build({
      structuredResult: {
        correction: {
          criteria: [{ key: 'decision-position' }],
          unsureCriteria: ['evidence-selection'],
        },
      },
    });
    await expect(record(repository, 'evidence-selection')).resolves.toEqual({
      recordedAt: new Date('2026-08-29T10:00:00.000Z'),
      status: 'RECORDED',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('remplace le verdict au lieu d’en empiler un second', async () => {
    const { repository, upsert } = build(delivered);
    await record(repository);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { verdict: 'WRONG' },
        where: {
          correctionId_userId_criterionKey: {
            correctionId: CORRECTION_ID,
            criterionKey: 'decision-position',
            userId: USER_ID,
          },
        },
      }),
    );
  });

  it('survit à une correction sans résultat structuré', async () => {
    const { repository } = build({ structuredResult: null });
    await expect(record(repository)).resolves.toEqual({
      status: 'UNKNOWN_CRITERION',
    });
  });

  it('regroupe les verdicts par correction pour l’historique', async () => {
    const prisma = {
      aiCorrection: { findFirst: vi.fn() },
      aiCorrectionCriterionFeedback: {
        findMany: vi.fn(async () => [
          {
            correctionId: CORRECTION_ID,
            criterionKey: 'decision-position',
            verdict: 'WRONG',
          },
          {
            correctionId: CORRECTION_ID,
            criterionKey: 'evidence-selection',
            verdict: 'HELPFUL',
          },
        ]),
        upsert: vi.fn(),
      },
    };
    const repository = new PrismaCorrectionFeedbackRepository(prisma as never);
    await expect(
      repository.listForCorrections({
        correctionIds: [CORRECTION_ID],
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      [CORRECTION_ID]: {
        'decision-position': 'WRONG',
        'evidence-selection': 'HELPFUL',
      },
    });
  });

  it('n’interroge pas la base sans correction à consulter', async () => {
    const findMany = vi.fn(async () => []);
    const repository = new PrismaCorrectionFeedbackRepository({
      aiCorrectionCriterionFeedback: { findMany },
    } as never);
    await expect(
      repository.listForCorrections({ correctionIds: [], userId: USER_ID }),
    ).resolves.toEqual({});
    expect(findMany).not.toHaveBeenCalled();
  });
});
