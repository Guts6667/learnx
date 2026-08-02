import {
  ConceptProgressStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../generated/prisma/client';
import { getStageValidation, refreshStageValidation } from './stage-validation';

const now = new Date('2026-08-03T08:00:00.000Z');

function createPrisma(stage: object | null) {
  const upsert = vi.fn(() => Promise.resolve({}));
  const prisma = {
    stage: { findFirst: vi.fn(() => Promise.resolve(stage)) },
    stageProgress: { upsert },
  } as unknown as PrismaClient;

  return { prisma, upsert };
}

function stageRecord() {
  return {
    assessments: [
      {
        id: 'assessment-1',
        submissions: [
          {
            status:
              StageAssessmentSubmissionStatus.VALIDATED as StageAssessmentSubmissionStatus,
          },
        ],
        title: 'Étude de cas',
      },
    ],
    estimatedDurationDays: 7,
    modules: [
      {
        lessons: [
          {
            concepts: [
              {
                id: 'concept-1',
                progress: [
                  {
                    status:
                      ConceptProgressStatus.VALIDATED as ConceptProgressStatus,
                  },
                ],
                title: 'Notion',
              },
            ],
            tasks: [
              {
                completions: [
                  {
                    status: TaskCompletionStatus.DONE as TaskCompletionStatus,
                  },
                ],
                id: 'task-1',
                title: 'Exercice',
              },
            ],
          },
        ],
      },
    ],
    progress: [
      {
        completedAt: null as Date | null,
        percent: 100,
        startedAt: new Date('2026-08-02T08:00:00.000Z'),
        status: StageProgressStatus.IN_PROGRESS as StageProgressStatus,
        targetEndAt: null,
      },
    ],
  };
}

describe('stage validation persistence', () => {
  it('agrège les progressions obligatoires côté serveur', async () => {
    const { prisma } = createPrisma(stageRecord());

    await expect(
      getStageValidation(prisma, 'stage-1', 'user-1'),
    ).resolves.toMatchObject({
      isValidated: true,
      missingRequirements: [],
      status: 'COMPLETED',
    });
  });

  it('persiste la fin de l’étape lorsque toutes les règles sont satisfaites', async () => {
    const { prisma, upsert } = createPrisma(stageRecord());

    await refreshStageValidation(prisma, 'stage-1', 'user-1', now);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          completedAt: now,
          status: StageProgressStatus.COMPLETED,
        }),
      }),
    );
  });

  it('retire la complétion lorsqu’une exigence obligatoire manque', async () => {
    const stage = stageRecord();
    stage.progress[0].status = StageProgressStatus.COMPLETED;
    stage.progress[0].completedAt = new Date('2026-08-02T12:00:00.000Z');
    stage.modules[0].lessons[0].tasks[0].completions[0].status =
      TaskCompletionStatus.SKIPPED;
    const { prisma, upsert } = createPrisma(stage);

    await refreshStageValidation(prisma, 'stage-1', 'user-1', now);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          completedAt: null,
          status: StageProgressStatus.IN_PROGRESS,
        }),
      }),
    );
  });
});
