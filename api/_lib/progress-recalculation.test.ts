import {
  ConceptProgressStatus,
  ExerciseSubmissionStatus,
  LessonProgressStatus,
  ResourceProgressStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../generated/prisma/client';
import {
  getLessonProgressSnapshot,
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../../src/server/api/_lib/progress-recalculation';

const lessonId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const moduleId = 'ac7cae6f-1888-4698-a049-925c21c23720';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const moduleRun = {
  id: 'd0575bf7-b4f7-4ab4-86db-5720d7a63885',
  moduleId,
  sequence: 1,
  startedAt: new Date('2026-08-03T08:00:00.000Z'),
  userId,
};
const programId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const stageId = '97476e0e-2103-40c0-8185-f7601a8d2fd2';
const now = new Date('2026-08-03T10:00:00.000Z');

function lessonState(options: { conceptValidated?: boolean } = {}) {
  return {
    moduleId,
    concepts: [
      {
        progress: [
          {
            status:
              options.conceptValidated === false
                ? ConceptProgressStatus.NEEDS_REVIEW
                : ConceptProgressStatus.VALIDATED,
          },
        ],
      },
    ],
    exercises: [
      { submissions: [{ status: ExerciseSubmissionStatus.SUBMITTED }] },
    ],
    isPublished: true,
    module: {
      isPublished: true,
      stage: {
        estimatedDurationDays: 7,
        id: stageId,
        isPublished: true,
        programId,
      },
    },
    progress: [],
    quizzes: [{ _count: { attempts: 1 }, attempts: [{ id: 'attempt-1' }] }],
    resources: [
      {
        id: 'resource-required',
        isRequired: true,
        progress: [{ status: ResourceProgressStatus.COMPLETED }],
      },
      {
        id: 'resource-optional',
        isRequired: false,
        progress: [],
      },
    ],
    tasks: [
      {
        completions: [{ status: TaskCompletionStatus.DONE }],
        id: 'task-required',
        isRequired: true,
      },
      {
        completions: [],
        id: 'task-optional',
        isRequired: false,
      },
    ],
  };
}

function stageState(percent: number) {
  return {
    assessments: [
      {
        id: 'assessment-1',
        submissions: [{ status: StageAssessmentSubmissionStatus.VALIDATED }],
        title: 'Évaluation finale',
      },
    ],
    estimatedDurationDays: 7,
    modules: [
      {
        lessons: [
          {
            id: lessonId,
            concepts: [
              {
                id: 'concept-1',
                progress: [{ status: ConceptProgressStatus.VALIDATED }],
                title: 'Notion',
              },
            ],
            progress: [{ percent }],
            tasks: [
              {
                completions: [{ status: TaskCompletionStatus.DONE }],
                id: 'task-required',
                title: 'Tâche',
              },
            ],
          },
        ],
      },
    ],
    progress: [],
  };
}

describe('progress recalculation', () => {
  it('calcule les quatre catégories requises et ignore les éléments facultatifs', async () => {
    const prisma = {
      lesson: { findFirst: vi.fn(async () => lessonState()) },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
    } as unknown as PrismaClient;

    await expect(
      getLessonProgressSnapshot(prisma, lessonId, userId),
    ).resolves.toMatchObject({ canComplete: true, percent: 100 });
    expect(prisma.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: expect.objectContaining({
            stage: expect.objectContaining({
              progress: {
                none: { status: StageProgressStatus.LOCKED, userId },
              },
            }),
          }),
        }),
      }),
    );
  });

  it('bloque la complétion lorsque la maîtrise obligatoire manque', async () => {
    const transaction = {
      lesson: {
        findFirst: vi.fn(async () => lessonState({ conceptValidated: false })),
      },
      lessonProgress: { upsert: vi.fn() },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
    };

    const snapshot = await recalculateLessonProgress(
      transaction as never,
      lessonId,
      userId,
      now,
      { completeRequested: true },
    );

    expect(snapshot).toMatchObject({ canComplete: false, percent: 100 });
    expect(transaction.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('bloque uniquement la terminaison lorsqu’une ressource obligatoire reste non consultée', async () => {
    const state = lessonState();
    state.resources[0].progress = [];
    const prisma = {
      lesson: { findFirst: vi.fn(async () => state) },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
    } as unknown as PrismaClient;

    await expect(
      getLessonProgressSnapshot(prisma, lessonId, userId),
    ).resolves.toMatchObject({ canComplete: false, percent: 100 });
  });

  it('répare sans démarrer silencieusement une leçon sans activité', async () => {
    const inactiveLesson = lessonState();
    inactiveLesson.concepts = [];
    inactiveLesson.exercises = [];
    inactiveLesson.quizzes = [];
    inactiveLesson.resources = [];
    inactiveLesson.tasks = [];
    const transaction = {
      lesson: { findFirst: vi.fn(async () => inactiveLesson) },
      lessonProgress: { upsert: vi.fn() },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
    };

    await recalculateLessonProgress(
      transaction as never,
      lessonId,
      userId,
      now,
      { startIfMissing: false },
    );

    expect(transaction.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('persiste leçon, étape et programme dans la transaction courante', async () => {
    let persistedPercent = 0;
    const lessonProgressUpsert = vi.fn(async (input: { create: object }) => {
      persistedPercent = 100;
      return {
        ...input.create,
        completedAt: now,
        percent: 100,
        startedAt: now,
        status: LessonProgressStatus.COMPLETED,
      };
    });
    const stageProgressUpsert = vi.fn(async () => ({}));
    const programProgressUpsert = vi.fn(async () => ({}));
    const transaction = {
      lesson: { findFirst: vi.fn(async () => lessonState()) },
      lessonProgress: { upsert: lessonProgressUpsert },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
      program: {
        findUnique: vi.fn(async () => ({
          stages: [stageState(persistedPercent)],
        })),
      },
      programProgress: { upsert: programProgressUpsert },
      stage: {
        findUnique: vi.fn(async () => stageState(persistedPercent)),
      },
      stageProgress: { upsert: stageProgressUpsert },
    };

    const snapshot = await recalculateLessonProgress(
      transaction as never,
      lessonId,
      userId,
      now,
      { completeRequested: true },
    );

    expect(snapshot?.lessonProgress?.status).toBe(
      LessonProgressStatus.COMPLETED,
    );
    expect(stageProgressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          percent: 100,
          status: StageProgressStatus.COMPLETED,
        }),
      }),
    );
    expect(programProgressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ percent: 100 }),
      }),
    );
    expect(transaction.lesson.findFirst).toHaveBeenCalledTimes(2);
  });

  it('réessaie un conflit sérialisable puis réussit sans écriture partielle', async () => {
    const operation = vi.fn(async () => 'ok');
    const transaction = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(operation);
    const prisma = { $transaction: transaction } as unknown as PrismaClient;

    await expect(
      runSerializableProgressTransaction(prisma, async () => 'ok'),
    ).resolves.toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      maxWait: 5_000,
      timeout: 15_000,
    });
  });

  it('limite les reprises de conflit concurrent', async () => {
    const transaction = vi.fn().mockRejectedValue({ code: 'P2034' });
    const prisma = { $transaction: transaction } as unknown as PrismaClient;

    await expect(
      runSerializableProgressTransaction(prisma, async () => undefined),
    ).rejects.toEqual({ code: 'P2034' });
    expect(transaction).toHaveBeenCalledTimes(3);
  });
});
