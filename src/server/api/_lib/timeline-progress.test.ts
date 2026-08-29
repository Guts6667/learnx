import {
  StageProgressStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  calculateProgramPercent,
  calculateStagePercent,
  getProgramTimeline,
  getStageTimeline,
  refreshTimelineForLessonActivity,
} from './timeline-progress.js';

const lessonId = '11111111-1111-4111-8111-111111111111';
const stageId = '22222222-2222-4222-8222-222222222222';
const programId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-08-28T09:00:00.000Z');

describe('timeline progress persistence', () => {
  it('aggregates published lesson progress without leaking invalid percentages', () => {
    expect(calculateStagePercent({ modules: [] })).toBe(0);
    expect(
      calculateStagePercent({
        modules: [
          {
            lessons: [
              { progress: [{ percent: -20 }] },
              { progress: [{ percent: 140 }] },
              { progress: [] },
            ],
          },
        ],
      }),
    ).toBeCloseTo(33.33, 2);
    expect(calculateProgramPercent([])).toBe(0);
    expect(
      calculateProgramPercent([
        { modules: [{ lessons: [{ progress: [{ percent: 100 }] }] }] },
        { modules: [{ lessons: [{ progress: [{ percent: 50 }] }] }] },
      ]),
    ).toBe(75);
  });

  it('returns null for inaccessible stages and programs', async () => {
    const client = {
      program: { findFirst: vi.fn(async () => null) },
      stage: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    await expect(
      getStageTimeline(client, stageId, userId, now),
    ).resolves.toBeNull();
    await expect(
      getProgramTimeline(client, programId, userId, now),
    ).resolves.toBeNull();
  });

  it('calculates stage and program snapshots from the persisted schedule', async () => {
    const startedAt = new Date('2026-08-18T09:00:00.000Z');
    const targetEndAt = new Date('2026-09-07T09:00:00.000Z');
    const client = {
      program: {
        findFirst: vi.fn(async () => ({
          progress: [{ completedAt: null, startedAt, targetEndAt }],
          stages: [
            { modules: [{ lessons: [{ progress: [{ percent: 60 }] }] }] },
          ],
        })),
      },
      stage: {
        findFirst: vi.fn(async () => ({
          modules: [{ lessons: [{ progress: [{ percent: 40 }] }] }],
          progress: [{ completedAt: null, startedAt, targetEndAt }],
        })),
      },
    } as unknown as PrismaClient;

    await expect(
      getStageTimeline(client, stageId, userId, now),
    ).resolves.toMatchObject({
      actualPercent: 40,
      expectedPercent: 50,
      temporalStatus: 'behind',
    });
    await expect(
      getProgramTimeline(client, programId, userId, now),
    ).resolves.toMatchObject({
      actualPercent: 60,
      expectedPercent: 50,
      temporalStatus: 'ahead',
    });
  });

  it('does not create hierarchy progress when the lesson or a timeline is unavailable', async () => {
    const missingLesson = {
      lesson: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;
    await expect(
      refreshTimelineForLessonActivity(missingLesson, lessonId, userId, now),
    ).resolves.toBeNull();

    const missingTimeline = {
      lesson: {
        findFirst: vi.fn(async () => ({
          module: {
            stage: {
              estimatedDurationDays: 7,
              id: stageId,
              programId,
              progress: [],
            },
          },
        })),
      },
      program: { findFirst: vi.fn(async () => null) },
      stage: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;
    await expect(
      refreshTimelineForLessonActivity(missingTimeline, lessonId, userId, now),
    ).resolves.toBeNull();
  });

  it.each([
    {
      existing: null,
      expectedStatus: StageProgressStatus.IN_PROGRESS,
      expectedStartedAt: now,
    },
    {
      existing: {
        completedAt: now,
        percent: 100,
        startedAt: new Date('2026-08-20T09:00:00.000Z'),
        status: StageProgressStatus.COMPLETED,
        targetEndAt: new Date('2026-08-30T09:00:00.000Z'),
      },
      expectedStatus: StageProgressStatus.COMPLETED,
      expectedStartedAt: new Date('2026-08-20T09:00:00.000Z'),
    },
  ])(
    'refreshes stage and program atomically for existing progress $existing',
    async ({ existing, expectedStartedAt, expectedStatus }) => {
      const stageProgressUpsert = vi.fn(async () => ({}));
      const programProgressUpsert = vi.fn(async () => ({}));
      const transaction = vi.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      );
      const stageRecord = {
        modules: [{ lessons: [{ progress: [{ percent: 75 }] }] }],
        progress: existing ? [existing] : [],
      };
      const client = {
        $transaction: transaction,
        lesson: {
          findFirst: vi.fn(async () => ({
            module: {
              stage: {
                estimatedDurationDays: 10,
                id: stageId,
                programId,
                progress: existing ? [existing] : [],
              },
            },
          })),
        },
        program: {
          findFirst: vi.fn(async () => ({
            progress: [],
            stages: [stageRecord],
          })),
        },
        programProgress: { upsert: programProgressUpsert },
        stage: { findFirst: vi.fn(async () => stageRecord) },
        stageProgress: { upsert: stageProgressUpsert },
      } as unknown as PrismaClient;

      await expect(
        refreshTimelineForLessonActivity(client, lessonId, userId, now),
      ).resolves.toBe(stageId);
      expect(transaction).toHaveBeenCalledOnce();
      expect(stageProgressUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            percent: 75,
            startedAt: expectedStartedAt,
            status: StageProgressStatus.IN_PROGRESS,
          }),
          update: expect.objectContaining({
            percent: 75,
            startedAt: expectedStartedAt,
            status: expectedStatus,
          }),
        }),
      );
      expect(programProgressUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ percent: 75, programId, userId }),
        }),
      );
    },
  );
});
