import {
  type PrismaClient,
  type ProgramStatus,
  type ProgramVisibility,
} from '../../../../generated/prisma/client.js';
import { editorialProgramWhere } from '../_lib/program-access-policy.js';

export interface AdminProgramSummary {
  id: string;
  position: number;
  slug: string;
  status: ProgramStatus;
  title: string;
  updatedAt: Date;
  visibility: ProgramVisibility;
  publishedVersion: {
    checksum: string;
    id: string;
    publishedAt: Date;
    version: number;
  } | null;
}

export interface AdminStageSummary {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  title: string;
}

export interface AdminModuleSummary {
  description: string;
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  title: string;
}

export interface AdminLessonSummary {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

export interface AdminProgramDetail extends AdminProgramSummary {
  stages: AdminStageSummary[];
}

export interface AdminStageDetail extends AdminStageSummary {
  modules: AdminModuleSummary[];
  program: AdminProgramSummary;
}

export interface AdminModuleDetail extends AdminModuleSummary {
  lessons: AdminLessonSummary[];
  stage: AdminStageSummary & { program: AdminProgramSummary };
}

export interface AdminLessonDetail extends AdminLessonSummary {
  module: AdminModuleSummary & {
    stage: AdminStageSummary & { program: AdminProgramSummary };
  };
}

export interface AdminNavigationService {
  findLesson(
    lessonId: string,
    ownerId: string,
  ): Promise<AdminLessonDetail | null>;
  findModule(
    moduleId: string,
    ownerId: string,
  ): Promise<AdminModuleDetail | null>;
  findProgram(
    programId: string,
    ownerId: string,
  ): Promise<AdminProgramDetail | null>;
  findStage(stageId: string, ownerId: string): Promise<AdminStageDetail | null>;
  listPrograms(ownerId: string): Promise<AdminProgramSummary[]>;
}

const programSummarySelect = {
  id: true,
  position: true,
  slug: true,
  status: true,
  title: true,
  updatedAt: true,
  visibility: true,
  publishedVersion: {
    select: {
      checksum: true,
      id: true,
      publishedAt: true,
      version: true,
    },
  },
} as const;

const stageSummarySelect = {
  id: true,
  isPublished: true,
  position: true,
  slug: true,
  title: true,
} as const;

const moduleSummarySelect = {
  description: true,
  id: true,
  isPublished: true,
  position: true,
  slug: true,
  title: true,
} as const;

const lessonSummarySelect = {
  id: true,
  isPublished: true,
  position: true,
  slug: true,
  summary: true,
  title: true,
} as const;

export function createPrismaAdminNavigationService(
  client: PrismaClient,
): AdminNavigationService {
  return {
    async findLesson(lessonId, ownerId) {
      return client.lesson.findFirst({
        where: {
          id: lessonId,
          module: { stage: { program: editorialProgramWhere(ownerId) } },
        },
        select: {
          ...lessonSummarySelect,
          module: {
            select: {
              ...moduleSummarySelect,
              stage: {
                select: {
                  ...stageSummarySelect,
                  program: { select: programSummarySelect },
                },
              },
            },
          },
        },
      });
    },
    async findModule(moduleId, ownerId) {
      return client.module.findFirst({
        where: {
          id: moduleId,
          stage: { program: editorialProgramWhere(ownerId) },
        },
        select: {
          ...moduleSummarySelect,
          lessons: {
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: lessonSummarySelect,
          },
          stage: {
            select: {
              ...stageSummarySelect,
              program: { select: programSummarySelect },
            },
          },
        },
      });
    },
    async findProgram(programId, ownerId) {
      return client.program.findFirst({
        where: { id: programId, ...editorialProgramWhere(ownerId) },
        select: {
          ...programSummarySelect,
          stages: {
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: stageSummarySelect,
          },
        },
      });
    },
    async findStage(stageId, ownerId) {
      return client.stage.findFirst({
        where: { id: stageId, program: editorialProgramWhere(ownerId) },
        select: {
          ...stageSummarySelect,
          modules: {
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: moduleSummarySelect,
          },
          program: { select: programSummarySelect },
        },
      });
    },
    async listPrograms(ownerId) {
      return client.program.findMany({
        where: editorialProgramWhere(ownerId),
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: programSummarySelect,
      });
    },
  };
}
