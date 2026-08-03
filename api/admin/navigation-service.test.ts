import type { PrismaClient } from '../../generated/prisma/client.js';
import { createPrismaAdminNavigationService } from '../../src/server/api/admin/navigation-service';

const ownerId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';

function createClient() {
  const client = {
    lesson: {
      findFirst: vi.fn(async (query: unknown) => {
        void query;
        return null;
      }),
    },
    module: {
      findFirst: vi.fn(async (query: unknown) => {
        void query;
        return null;
      }),
    },
    program: {
      findFirst: vi.fn(async (query: unknown) => {
        void query;
        return null;
      }),
      findMany: vi.fn(async (query: unknown) => {
        void query;
        return [];
      }),
    },
    stage: {
      findFirst: vi.fn(async (query: unknown) => {
        void query;
        return null;
      }),
    },
  };

  return { client, prisma: client as unknown as PrismaClient };
}

describe('AdminNavigationService', () => {
  it('filtre chaque lecture par le propriétaire', async () => {
    const fixture = createClient();
    const service = createPrismaAdminNavigationService(fixture.prisma);

    await service.listPrograms(ownerId);
    await service.findProgram('program-1', ownerId);
    await service.findStage('stage-1', ownerId);
    await service.findModule('module-1', ownerId);
    await service.findLesson('lesson-1', ownerId);

    expect(fixture.client.program.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId } }),
    );
    expect(fixture.client.program.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'program-1', ownerId } }),
    );
    expect(fixture.client.stage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stage-1', program: { ownerId } },
      }),
    );
    expect(fixture.client.module.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'module-1', stage: { program: { ownerId } } },
      }),
    );
    expect(fixture.client.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'lesson-1',
          module: { stage: { program: { ownerId } } },
        },
      }),
    );
  });

  it('ne sélectionne que les enfants immédiats du niveau demandé', async () => {
    const fixture = createClient();
    const service = createPrismaAdminNavigationService(fixture.prisma);

    await service.findProgram('program-1', ownerId);
    await service.findStage('stage-1', ownerId);
    await service.findModule('module-1', ownerId);

    const programQuery = fixture.client.program.findFirst.mock
      .calls[0]?.[0] as {
      select: { stages: { select: Record<string, unknown> } };
    };
    const stageQuery = fixture.client.stage.findFirst.mock.calls[0]?.[0] as {
      select: { modules: { select: Record<string, unknown> } };
    };
    const moduleQuery = fixture.client.module.findFirst.mock.calls[0]?.[0] as {
      select: { lessons: { select: Record<string, unknown> } };
    };

    expect(programQuery?.select.stages.select).not.toHaveProperty('modules');
    expect(stageQuery?.select.modules.select).not.toHaveProperty('lessons');
    expect(moduleQuery?.select.lessons.select).not.toHaveProperty('concepts');
  });
});
