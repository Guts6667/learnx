import {
  TranslationWorkflowStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client';
import { createPrismaTranslationWorkflowService } from './translation-workflow-service';

const actorUserId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const sourceVersionId = 'c29e4b75-f73a-47de-b67c-cd6a38262b2f';
const reviewedAt = new Date('2026-08-09T10:00:00.000Z');
const completeQa = {
  bibliographicTitles: true,
  culturalAndLegalContext: true,
  distractors: true,
  instructions: true,
  languageLevel: true,
  links: true,
  resources: true,
  rubrics: true,
  structure: true,
  terminology: true,
};

function createDatabase() {
  let workflow: Record<string, unknown> | null = null;
  const applyData = (data: Record<string, unknown>) => {
    if (!workflow) throw new Error('Missing workflow.');
    for (const [key, value] of Object.entries(data)) {
      if (key === 'version') {
        workflow.version = Number(workflow.version) + 1;
      } else if (key === 'linguisticReviewer') {
        workflow.linguisticReviewerId = actorUserId;
      } else if (key === 'pedagogicalReviewer') {
        workflow.pedagogicalReviewerId = actorUserId;
      } else if (key === 'culturalLegalReviewer') {
        workflow.culturalLegalReviewerId = actorUserId;
      } else if (key === 'approvedBy') {
        workflow.approvedByUserId = actorUserId;
      } else if (key === 'sourceProgramVersion') {
        workflow.sourceProgramVersionId = sourceVersionId;
      } else {
        workflow[key] = value;
      }
    }
    workflow.updatedAt = reviewedAt;
    return workflow;
  };
  const transaction = {
    auditEvent: { upsert: vi.fn() },
    program: {
      findFirst: vi.fn(async () => ({
        canonicalProgramKey: 'canonical-program',
        id: programId,
        locale: 'en',
      })),
    },
    programTranslationWorkflow: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        workflow = {
          approvedAt: null,
          approvedByUserId: null,
          culturalLegalReviewedAt: null,
          culturalLegalReviewerId: null,
          glossaryVersion: data.glossaryVersion,
          linguisticReviewedAt: null,
          linguisticReviewerId: null,
          pedagogicalReviewedAt: null,
          pedagogicalReviewerId: null,
          programId,
          qaChecks: {},
          sourceProgramVersionId: sourceVersionId,
          status: TranslationWorkflowStatus.DRAFT,
          updatedAt: reviewedAt,
          version: 1,
        };
        return workflow;
      }),
      findFirst: vi.fn(async () => workflow),
      findUnique: vi.fn(async () => workflow),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
        applyData(data),
      ),
    },
    programVersion: {
      findFirst: vi.fn(async (): Promise<{ id: string } | null> => ({
        id: sourceVersionId,
      })),
    },
  };
  const client = {
    ...transaction,
    $transaction: async <T>(
      operation: (client: typeof transaction) => Promise<T>,
    ) => operation(transaction),
  } as unknown as PrismaClient;
  return { client, transaction };
}

describe('translation workflow service', () => {
  it('requires all human reviews and QA before approval', async () => {
    const { client, transaction } = createDatabase();
    const service = createPrismaTranslationWorkflowService(
      client,
      () => reviewedAt,
    );
    let result = await service.transition(actorUserId, programId, {
      action: 'CONFIGURE',
      expectedVersion: 0,
      glossaryVersion: '1.0.0',
      sourceProgramVersionId: sourceVersionId,
    });
    expect(result.kind).toBe('APPLIED');

    result = await service.transition(actorUserId, programId, {
      action: 'SUBMIT',
      expectedVersion: 1,
    });
    expect(result.kind).toBe('APPLIED');
    expect(
      await service.transition(actorUserId, programId, {
        action: 'APPROVE',
        expectedVersion: 2,
      }),
    ).toEqual({ kind: 'INVALID_TRANSITION' });

    for (const [action, version] of [
      ['APPROVE_LINGUISTIC', 2],
      ['APPROVE_PEDAGOGICAL', 3],
      ['APPROVE_CULTURAL_LEGAL', 4],
    ] as const) {
      expect(
        await service.transition(actorUserId, programId, {
          action,
          expectedVersion: version,
        }),
      ).toMatchObject({ kind: 'APPLIED' });
    }
    expect(
      await service.transition(actorUserId, programId, {
        action: 'VALIDATE_QA',
        expectedVersion: 5,
        qaChecks: completeQa,
      }),
    ).toMatchObject({ kind: 'APPLIED' });
    expect(
      await service.transition(actorUserId, programId, {
        action: 'APPROVE',
        expectedVersion: 6,
      }),
    ).toMatchObject({
      kind: 'APPLIED',
      workflow: { status: TranslationWorkflowStatus.APPROVED, version: 7 },
    });
    expect(transaction.auditEvent.upsert).toHaveBeenCalledTimes(7);
  });

  it('rejects stale transitions and a source outside the canonical French program', async () => {
    const { client, transaction } = createDatabase();
    const service = createPrismaTranslationWorkflowService(
      client,
      () => reviewedAt,
    );
    transaction.programVersion.findFirst.mockResolvedValueOnce(null);
    expect(
      await service.transition(actorUserId, programId, {
        action: 'CONFIGURE',
        expectedVersion: 0,
        glossaryVersion: '1.0.0',
        sourceProgramVersionId: sourceVersionId,
      }),
    ).toEqual({ kind: 'INVALID_SOURCE' });
  });
});
