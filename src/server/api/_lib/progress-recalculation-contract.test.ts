import { describe, expect, it, vi } from 'vitest';

import {
  CanonicalActivityKind,
  ExerciseSubmissionStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { getLessonProgressSnapshot } from './progress-recalculation-lesson-snapshot.js';
import { recalculateStageAndProgram } from './progress-recalculation-stage.js';
import type { LessonProgressSnapshot } from './progress-recalculation-types.js';

const lessonId = '11111111-1111-4111-8111-111111111111';
const secondLessonId = '22222222-2222-4222-8222-222222222222';
const moduleId = '33333333-3333-4333-8333-333333333333';
const moduleRunId = '44444444-4444-4444-8444-444444444444';
const stageId = '55555555-5555-4555-8555-555555555555';
const programId = '66666666-6666-4666-8666-666666666666';
const userId = '77777777-7777-4777-8777-777777777777';
const now = new Date('2026-08-28T09:00:00.000Z');

function completedSnapshot(
  taskId: string,
  exerciseId: string,
): LessonProgressSnapshot {
  return {
    canComplete: true,
    conceptStatusById: new Map(),
    exerciseStatusById: new Map([
      [exerciseId, ExerciseSubmissionStatus.SUBMITTED],
    ]),
    lessonProgress: null,
    percent: 100,
    quizPassedById: new Map(),
    resourceStatusById: new Map(),
    taskStatusById: new Map([[taskId, TaskCompletionStatus.DONE]]),
  };
}

function multiModuleStage() {
  return {
    assessments: [
      {
        id: 'assessment-1',
        submissions: [{ status: StageAssessmentSubmissionStatus.VALIDATED }],
        title: 'Évaluation finale',
      },
    ],
    estimatedDurationDays: 10,
    modules: [
      {
        lessons: [
          {
            concepts: [],
            exercises: [{ id: 'exercise-1', title: 'Exercice 1' }],
            id: lessonId,
            progress: [{ percent: 100 }],
            tasks: [{ id: 'task-1', title: 'Tâche 1' }],
          },
        ],
      },
      {
        lessons: [
          {
            concepts: [],
            exercises: [{ id: 'exercise-2', title: 'Exercice 2' }],
            id: secondLessonId,
            progress: [{ percent: 50 }],
            tasks: [{ id: 'task-2', title: 'Tâche 2' }],
          },
        ],
      },
    ],
    progress: [],
  };
}

function programFromStage(stage: ReturnType<typeof multiModuleStage>) {
  return {
    stages: [
      {
        modules: stage.modules.map((module) => ({
          lessons: module.lessons.map((lesson) => ({
            progress: lesson.progress,
          })),
        })),
      },
    ],
  };
}

describe('progress recalculation contracts', () => {
  it('applies carryovers only through the current module run selection', async () => {
    const state = {
      activityCompletionCarryovers: [
        { activityKey: 'task-key', kind: CanonicalActivityKind.TASK },
        {
          activityKey: 'exercise-key',
          kind: CanonicalActivityKind.EXERCISE,
        },
      ],
      concepts: [],
      exercises: [
        {
          id: 'exercise-id',
          key: 'exercise-key',
          submissions: [],
        },
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
      quizzes: [],
      resources: [],
      tasks: [
        {
          completions: [],
          id: 'task-id',
          isRequired: true,
          key: 'task-key',
        },
      ],
    };
    const lessonFindFirst = vi
      .fn()
      .mockResolvedValueOnce({ moduleId })
      .mockResolvedValueOnce(state);
    const client = {
      lesson: { findFirst: lessonFindFirst },
      moduleRun: {
        findFirst: vi.fn(async () => ({
          id: moduleRunId,
          moduleId,
          sequence: 2,
          startedAt: now,
          userId,
        })),
      },
    } as unknown as PrismaClient;

    await expect(
      getLessonProgressSnapshot(client, lessonId, userId),
    ).resolves.toMatchObject({ canComplete: true, percent: 100 });
    const selection = lessonFindFirst.mock.calls[1]?.[0]?.select;
    expect(selection.activityCompletionCarryovers.where).toMatchObject({
      moduleRunId,
      userId,
    });
    expect(selection.exercises.select.submissions.where).toMatchObject({
      moduleRunId,
      userId,
    });
  });

  it('aggregates all published modules before persisting stage and program', async () => {
    const stage = multiModuleStage();
    const transaction = {
      lesson: { findFirst: vi.fn() },
      program: { findUnique: vi.fn(async () => programFromStage(stage)) },
      programProgress: { upsert: vi.fn(async () => ({})) },
      stage: { findUnique: vi.fn(async () => stage) },
      stageProgress: { upsert: vi.fn(async () => ({})) },
    };
    const known = new Map([
      [lessonId, completedSnapshot('task-1', 'exercise-1')],
      [secondLessonId, completedSnapshot('task-2', 'exercise-2')],
    ]);

    await recalculateStageAndProgram(
      transaction as never,
      stageId,
      programId,
      userId,
      now,
      known,
    );

    expect(transaction.lesson.findFirst).not.toHaveBeenCalled();
    expect(transaction.stageProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          percent: 75,
          status: StageProgressStatus.COMPLETED,
        }),
      }),
    );
    expect(transaction.programProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ percent: 75 }),
      }),
    );
  });
});
