import {
  CanonicalActivityKind,
  ConceptProgressStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  getStageValidation,
  refreshStageValidation,
} from './stage-validation.js';

const stageId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-08-28T09:00:00.000Z');

function stageState(options: { complete?: boolean; withProgress?: boolean } = {}) {
  const complete = options.complete === true;
  return {
    assessments: [
      {
        id: 'assessment-id',
        submissions: complete
          ? [{ status: StageAssessmentSubmissionStatus.VALIDATED }]
          : [],
        title: 'Évaluation finale',
      },
    ],
    estimatedDurationDays: 8,
    modules: [
      {
        id: 'module-id',
        lessons: [
          {
            concepts: [
              {
                id: 'concept-id',
                progress: complete
                  ? [{ status: ConceptProgressStatus.VALIDATED }]
                  : [],
                title: 'Concept requis',
              },
            ],
            exercises: [
              { id: 'exercise-direct', key: 'direct', title: 'Exercice direct' },
              {
                id: 'exercise-carryover',
                key: 'carryover',
                title: 'Exercice reporté',
              },
            ],
            id: 'lesson-id',
            tasks: [
              {
                completions: complete
                  ? [{ status: TaskCompletionStatus.DONE }]
                  : [],
                id: 'task-direct',
                key: 'direct',
                title: 'Tâche directe',
              },
              {
                completions: [],
                id: 'task-carryover',
                key: 'carryover',
                title: 'Tâche reportée',
              },
            ],
          },
        ],
      },
    ],
    progress: options.withProgress
      ? [
          {
            completedAt: null,
            percent: 75,
            startedAt: new Date('2026-08-20T09:00:00.000Z'),
            status: StageProgressStatus.IN_PROGRESS,
            targetEndAt: new Date('2026-08-30T09:00:00.000Z'),
          },
        ]
      : [],
  };
}

function clientForStage(
  stage: ReturnType<typeof stageState> | null,
  options: { withRun?: boolean } = {},
) {
  const stageProgressUpsert = vi.fn(async () => ({}));
  return {
    activityCompletionCarryover: {
      findMany: vi.fn(async () =>
        options.withRun
          ? [
              {
                activityKey: 'carryover',
                kind: CanonicalActivityKind.TASK,
                lessonId: 'lesson-id',
              },
              {
                activityKey: 'carryover',
                kind: CanonicalActivityKind.EXERCISE,
                lessonId: 'lesson-id',
              },
            ]
          : [],
      ),
    },
    exerciseSubmission: {
      findMany: vi.fn(async () =>
        options.withRun ? [{ exerciseId: 'exercise-direct' }] : [],
      ),
    },
    moduleRun: {
      findFirst: vi.fn(async () =>
        options.withRun
          ? {
              id: 'module-run-id',
              moduleId: 'module-id',
              sequence: 1,
              startedAt: now,
              userId,
            }
          : null,
      ),
    },
    stage: { findFirst: vi.fn(async () => stage) },
    stageProgress: { upsert: stageProgressUpsert },
  } as unknown as PrismaClient;
}

describe('stage validation persistence', () => {
  it('returns null without querying activities for an inaccessible stage', async () => {
    const client = clientForStage(null);
    await expect(getStageValidation(client, stageId, userId)).resolves.toBeNull();
    expect(client.moduleRun.findFirst).not.toHaveBeenCalled();
  });

  it('uses the preview scope without treating absent work as learner activity', async () => {
    const client = clientForStage(stageState());
    await expect(
      getStageValidation(client, stageId, userId, { preview: true }),
    ).resolves.toMatchObject({
      isValidated: false,
      status: StageProgressStatus.AVAILABLE,
    });
    expect(client.exerciseSubmission.findMany).not.toHaveBeenCalled();
    expect(client.activityCompletionCarryover.findMany).not.toHaveBeenCalled();
    expect(client.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ isPublished: true }) }),
    );
  });

  it('accepts current-run submissions and carryovers as scoped proof', async () => {
    const client = clientForStage(stageState({ complete: true }), {
      withRun: true,
    });
    await expect(getStageValidation(client, stageId, userId)).resolves.toMatchObject({
      isValidated: true,
      requiredExercises: { total: 2, validated: 2 },
      requiredTasks: { total: 2, validated: 2 },
      status: StageProgressStatus.COMPLETED,
    });
    expect(client.exerciseSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ moduleRunId: { in: ['module-run-id'] } }),
      }),
    );
  });

  it('starts an untouched incomplete stage while preserving deterministic dates', async () => {
    const client = clientForStage(stageState());
    await expect(
      refreshStageValidation(client, stageId, userId, now),
    ).resolves.toMatchObject({ status: StageProgressStatus.IN_PROGRESS });
    expect(client.stageProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          completedAt: null,
          percent: 0,
          startedAt: now,
          status: StageProgressStatus.IN_PROGRESS,
        }),
      }),
    );
  });

  it('completes a fully evidenced stage without replacing its existing schedule', async () => {
    const stage = stageState({ complete: true, withProgress: true });
    const client = clientForStage(stage, { withRun: true });
    await expect(
      refreshStageValidation(client, stageId, userId, now),
    ).resolves.toMatchObject({
      isValidated: true,
      status: StageProgressStatus.COMPLETED,
    });
    expect(client.stageProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          completedAt: now,
          percent: 75,
          startedAt: stage.progress[0]?.startedAt,
          status: StageProgressStatus.COMPLETED,
          targetEndAt: stage.progress[0]?.targetEndAt,
        }),
      }),
    );
  });

  it('does not persist progress if the stage disappeared before refresh', async () => {
    const client = clientForStage(null);
    await expect(
      refreshStageValidation(client, stageId, userId, now),
    ).resolves.toBeNull();
    expect(client.stageProgress.upsert).not.toHaveBeenCalled();
  });
});
