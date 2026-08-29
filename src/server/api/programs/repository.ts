import type { PrismaClient } from '../../../../generated/prisma/client.js';
import {
  getLessonDetailInclude,
  getModuleDetailInclude,
  getProgramDetailInclude,
  getProgramListInclude,
  getProgramStageIdsInclude,
} from './query-shapes.js';
import { getStageInclude } from './serialization.js';
import { getProgramAccessFilter, getPublicationFilter } from './validation.js';

class PrismaCurriculumRepository {
  constructor(private readonly client: PrismaClient) {}

  listPrograms(userId: string, preview: boolean) {
    return this.client.program.findMany({
      where: getProgramAccessFilter(userId, preview),
      orderBy: { position: 'asc' },
      include: getProgramListInclude(preview),
    });
  }

  findProgramsBySlug(programSlug: string, userId: string, preview: boolean) {
    return this.client.program.findMany({
      where: {
        ...getProgramAccessFilter(userId, preview),
        slug: programSlug,
      },
      take: 3,
      include: getProgramDetailInclude(preview, userId),
    });
  }

  findProgramStageIds(programSlug: string, userId: string, preview: boolean) {
    return this.client.program.findMany({
      where: {
        ...getProgramAccessFilter(userId, preview),
        slug: programSlug,
      },
      take: 3,
      include: getProgramStageIdsInclude(preview),
    });
  }

  findStages(
    programSlug: string,
    stageSlug: string,
    userId: string,
    preview: boolean,
  ) {
    return this.client.stage.findMany({
      where: {
        slug: stageSlug,
        ...getPublicationFilter(preview),
        program: {
          ...getProgramAccessFilter(userId, preview),
          slug: programSlug,
        },
      },
      take: 3,
      include: {
        ...getStageInclude(preview, userId),
        program: { select: { ownerId: true } },
      },
    });
  }

  findModules(moduleSlug: string, userId: string, preview: boolean) {
    return this.client.module.findMany({
      where: {
        slug: moduleSlug,
        ...getPublicationFilter(preview),
        stage: {
          ...getPublicationFilter(preview),
          program: { ...getProgramAccessFilter(userId, preview) },
        },
      },
      take: 2,
      include: getModuleDetailInclude(preview, userId),
    });
  }

  findLessons(lessonSlug: string, userId: string, preview: boolean) {
    return this.client.lesson.findMany({
      where: {
        slug: lessonSlug,
        ...getPublicationFilter(preview),
        module: {
          ...getPublicationFilter(preview),
          stage: {
            ...getPublicationFilter(preview),
            program: { ...getProgramAccessFilter(userId, preview) },
          },
        },
      },
      take: 2,
      include: getLessonDetailInclude(preview, userId),
    });
  }
}

export function createCurriculumRepository(client: PrismaClient) {
  return new PrismaCurriculumRepository(client);
}
