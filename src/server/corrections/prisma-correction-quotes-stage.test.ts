import { contractRaw } from './correction-orchestration.test-support';
import { PrismaCorrectionQuoteRepository } from './prisma-correction-quotes';

const QUOTE_ID = '0286768e-5b9c-491b-a4f4-f2e6863ef398';
const USER_ID = '6ce94140-7435-426a-9753-90faebc7695a';
const SUBMISSION_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    action: 'STANDARD',
    ceilingCredits: 18n,
    contractKey: 'stage-final-synthesis',
    contractVersion: '1.0.0',
    estimatedCredits: 12n,
    expiresAt: new Date('2026-08-24T12:00:00Z'),
    id: QUOTE_ID,
    includesAutomaticSecondPass: true,
    language: 'fr-FR',
    modelId: 'anthropic/claude-sonnet-4.6',
    promptVersion: '2.2.0',
    provider: 'Anthropic',
    requestFingerprint: 'a'.repeat(64),
    targetId: SUBMISSION_ID,
    targetKind: 'STAGE_ASSESSMENT_SUBMISSION',
    userId: USER_ID,
    ...overrides,
  };
}

/**
 * Records every call so a test can assert on what the correction path asked the
 * database to do, rather than on what came back out of it.
 */
function spyPrisma(stageSubmission: unknown) {
  const calls: string[] = [];
  const stageWhere: unknown[] = [];
  const record = (name: string) =>
    vi.fn(async (input?: { where?: unknown }) => {
      calls.push(name);
      if (name.startsWith('stageAssessmentSubmission')) {
        stageWhere.push(input?.where);
      }
      return name === 'stageAssessmentSubmission.findFirst'
        ? stageSubmission
        : null;
    });
  const model = (prefix: string) => ({
    create: record(`${prefix}.create`),
    delete: record(`${prefix}.delete`),
    findFirst: record(`${prefix}.findFirst`),
    findMany: record(`${prefix}.findMany`),
    update: record(`${prefix}.update`),
    updateMany: record(`${prefix}.updateMany`),
    upsert: record(`${prefix}.upsert`),
  });
  return {
    calls,
    prisma: {
      aiCorrection: model('aiCorrection'),
      aiPricingQuote: {
        ...model('aiPricingQuote'),
        findFirst: vi.fn(async () => {
          calls.push('aiPricingQuote.findFirst');
          return quoteRow();
        }),
      },
      stageAssessment: model('stageAssessment'),
      stageAssessmentSubmission: model('stageAssessmentSubmission'),
      stageProgress: model('stageProgress'),
      userProgress: model('userProgress'),
    },
    stageWhere,
  };
}

const submittedSubmission = {
  contentMarkdown: 'Ma synthèse de palier.',
  id: SUBMISSION_ID,
  stageAssessment: {
    description: 'Synthèse du palier 1.',
    instructions: 'Rédige une synthèse.',
    key: 'assessment-1',
    position: 1,
    rubric: [{ criterion: 'Synthèse', requirements: ['Relier'], weight: 100 }],
    stage: { slug: 'psychologie-palier-1' },
    title: 'Évaluation finale',
  },
  status: 'SUBMITTED',
  userId: USER_ID,
};

/** A stage assessment that already carries a valid, published contract. */
const contractedSubmission = {
  ...submittedSubmission,
  stageAssessment: {
    ...submittedSubmission.stageAssessment,
    rubric: {
      ...contractRaw,
      target: {
        activityKey: 'assessment-1',
        activityType: 'written_assignment',
        kind: 'STAGE_ASSESSMENT',
      },
    },
  },
};

describe('devis de correction sur une évaluation de palier', () => {
  it('interroge la remise en la bornant à son propriétaire', async () => {
    const { prisma, stageWhere } = spyPrisma(submittedSubmission);
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await repository.quotes.loadAcceptedQuote({
      now: new Date('2026-08-24T10:00:00Z'),
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    // The userId is part of the query, not a check applied after loading: a
    // submission belonging to someone else must be indistinguishable from one
    // that does not exist.
    expect(stageWhere).toEqual([{ id: SUBMISSION_ID, userId: USER_ID }]);
  });

  it('ne rend rien quand la remise appartient à quelqu’un d’autre', async () => {
    const { prisma } = spyPrisma(null);
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await expect(
      repository.quotes.loadAcceptedQuote({
        now: new Date('2026-08-24T10:00:00Z'),
        quoteId: QUOTE_ID,
        userId: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toBeNull();
  });

  it('refuse une rubrique héritée sans rien synthétiser', async () => {
    // Every seeded stage assessment carries this shape today, so this is the
    // real production answer until contracts are authored.
    const { prisma } = spyPrisma(submittedSubmission);
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await expect(
      repository.quotes.loadAcceptedQuote({
        now: new Date('2026-08-24T10:00:00Z'),
        quoteId: QUOTE_ID,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });

  it('accepte un contrat valide rattaché par la clé de l’évaluation', async () => {
    // V4.5-117 gave assessments a key, so belonging is checkable and this
    // resolves. What still refuses a stage-assessment correction is the
    // promoted identity's targetKindScope, one layer up in the pricing service
    // and again in the orchestration — this repository is not the last gate.
    const { prisma } = spyPrisma(contractedSubmission);
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await expect(
      repository.quotes.loadAcceptedQuote({
        now: new Date('2026-08-24T10:00:00Z'),
        quoteId: QUOTE_ID,
        userId: USER_ID,
      }),
    ).resolves.toMatchObject({
      target: { id: SUBMISSION_ID, kind: 'STAGE_ASSESSMENT_SUBMISSION' },
    });
  });

  it('n’écrit dans aucune table de progression', async () => {
    // Asserted on what the correction path asked the database to do, not on
    // what it returned. A write added anywhere in this path fails this test,
    // including one nobody thought to look for. Stage assessments carry the
    // score, reviewFeedback and reviewedAt that decide whether a learner
    // advances; the AI never touches them.
    const { calls, prisma } = spyPrisma(submittedSubmission);
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await repository.quotes.loadAcceptedQuote({
      now: new Date('2026-08-24T10:00:00Z'),
      quoteId: QUOTE_ID,
      userId: USER_ID,
    });

    const writes = calls.filter((call) =>
      /\.(create|delete|update|updateMany|upsert)$/.test(call),
    );
    expect(writes).toEqual([]);
    expect(calls).toEqual([
      'aiPricingQuote.findFirst',
      'stageAssessmentSubmission.findFirst',
    ]);
  });
});

describe('rattachement par clé (V4.5-117)', () => {
  it('refuse un contrat qui nomme une autre évaluation', async () => {
    // The whole point of the key: a runnable contract from a neighbouring
    // assessment must not be accepted here.
    const { prisma } = spyPrisma({
      ...contractedSubmission,
      stageAssessment: {
        ...contractedSubmission.stageAssessment,
        key: 'assessment-2',
      },
    });
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await expect(
      repository.quotes.loadAcceptedQuote({
        now: new Date('2026-08-24T10:00:00Z'),
        quoteId: QUOTE_ID,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });

  it('refuse une évaluation dont la clé est vide', async () => {
    // The schema forbids it; trusting an empty string would bind everything to
    // everything, so the refusal stays even though it should be unreachable.
    const { prisma } = spyPrisma({
      ...contractedSubmission,
      stageAssessment: { ...contractedSubmission.stageAssessment, key: '' },
    });
    const repository = new PrismaCorrectionQuoteRepository(prisma as never);

    await expect(
      repository.quotes.loadAcceptedQuote({
        now: new Date('2026-08-24T10:00:00Z'),
        quoteId: QUOTE_ID,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });
});
