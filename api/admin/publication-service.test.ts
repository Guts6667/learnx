import type { PrismaClient } from '../../generated/prisma/client';
import {
  createPrismaPublicationService,
  PublicationPlanStaleError,
} from '../../src/server/api/admin/publication-service';

const ownerId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const timestamp = new Date('2026-08-03T12:00:00.000Z');

function createModuleDatabase() {
  const state = {
    lessonPublished: false,
    modulePublished: false,
    updatedAt: timestamp,
  };
  const readModule = () => ({
    id: 'module-1',
    isPublished: state.modulePublished,
    lessons: [
      {
        concepts: [
          {
            assessments: [{ id: 'assessment-1' }],
            id: 'concept-1',
            title: 'Notion',
          },
        ],
        id: 'lesson-1',
        isPublished: state.lessonPublished,
        title: 'Leçon',
        updatedAt: state.updatedAt,
      },
    ],
    title: 'Module',
    updatedAt: state.updatedAt,
  });
  const transaction = {
    lesson: {
      async updateMany() {
        state.lessonPublished = true;
      },
    },
    module: {
      async findFirst() {
        return readModule();
      },
      async updateMany() {
        state.modulePublished = true;
      },
    },
    program: { update: vi.fn() },
    stage: { updateMany: vi.fn() },
  };
  const client = {
    ...transaction,
    async $transaction<T>(
      operation: (value: typeof transaction) => Promise<T>,
    ) {
      const snapshot = { ...state };
      try {
        return await operation(transaction);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
  } as unknown as PrismaClient;

  return { client, state };
}

describe('Prisma publication service', () => {
  it('rejette un aperçu obsolète mais accepte la répétition déjà appliquée', async () => {
    const fixture = createModuleDatabase();
    const service = createPrismaPublicationService(fixture.client);
    const request = {
      action: 'PUBLISH' as const,
      mode: 'FULL' as const,
      targetId: 'module-1',
      targetType: 'MODULE' as const,
    };
    const stalePreview = await service.preview(ownerId, request);
    expect(stalePreview).not.toBeNull();

    fixture.state.updatedAt = new Date('2026-08-03T12:01:00.000Z');
    await expect(
      service.apply(ownerId, {
        ...request,
        planId: stalePreview?.planId ?? '',
      }),
    ).rejects.toBeInstanceOf(PublicationPlanStaleError);

    const currentPreview = await service.preview(ownerId, request);
    await service.apply(ownerId, {
      ...request,
      planId: currentPreview?.planId ?? '',
    });
    expect(fixture.state).toMatchObject({
      lessonPublished: true,
      modulePublished: true,
    });

    await expect(
      service.apply(ownerId, {
        ...request,
        planId: currentPreview?.planId ?? '',
      }),
    ).resolves.not.toBeNull();
  });

  it('restaure les descendants si une écriture de la transaction échoue', async () => {
    const state = {
      lessonPublished: false,
      modulePublished: false,
      stagePublished: false,
    };
    const stageRecord = () => ({
      assessments: [{ id: 'final-1' }],
      id: 'stage-1',
      isPublished: state.stagePublished,
      modules: [
        {
          id: 'module-1',
          isPublished: state.modulePublished,
          lessons: [
            {
              concepts: [],
              id: 'lesson-1',
              isPublished: state.lessonPublished,
              title: 'Leçon',
              updatedAt: timestamp,
            },
          ],
          title: 'Module',
          updatedAt: timestamp,
        },
      ],
      title: 'Étape',
      updatedAt: timestamp,
    });
    const transaction = {
      lesson: {
        async updateMany() {
          state.lessonPublished = true;
        },
      },
      module: {
        async updateMany() {
          state.modulePublished = true;
        },
      },
      program: { update: vi.fn() },
      stage: {
        async findFirst() {
          return stageRecord();
        },
        async updateMany() {
          throw new Error('Forced stage write failure.');
        },
      },
    };
    const client = {
      ...transaction,
      async $transaction<T>(
        operation: (value: typeof transaction) => Promise<T>,
      ) {
        const snapshot = { ...state };
        try {
          return await operation(transaction);
        } catch (error) {
          Object.assign(state, snapshot);
          throw error;
        }
      },
    } as unknown as PrismaClient;
    const service = createPrismaPublicationService(client);
    const request = {
      action: 'PUBLISH' as const,
      mode: 'FULL' as const,
      targetId: 'stage-1',
      targetType: 'STAGE' as const,
    };
    const preview = await service.preview(ownerId, request);

    await expect(
      service.apply(ownerId, {
        ...request,
        planId: preview?.planId ?? '',
      }),
    ).rejects.toThrow('Forced stage write failure.');
    expect(state).toEqual({
      lessonPublished: false,
      modulePublished: false,
      stagePublished: false,
    });
  });
});
