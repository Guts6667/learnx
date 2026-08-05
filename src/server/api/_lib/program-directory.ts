import { z } from 'zod';

import {
  ProgramEnrollmentStatus,
  ProgramStatus,
  ProgramVisibility,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';

const catalogCursorSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  scope: z.literal('catalog'),
  search: z.string().nullable(),
  version: z.literal(1),
});

const enrolledCursorSchema = z.object({
  id: z.string().uuid(),
  scope: z.literal('enrolled'),
  search: z.string().nullable(),
  status: z.nativeEnum(ProgramEnrollmentStatus),
  updatedAt: z.string().datetime(),
  version: z.literal(1),
});

export class InvalidProgramDirectoryCursorError extends Error {
  public constructor() {
    super('Invalid program directory cursor.');
    this.name = 'InvalidProgramDirectoryCursorError';
  }
}

export interface ProgramDirectoryPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CatalogProgramSummary {
  description: string;
  estimatedDurationDays: number | null;
  icon: string | null;
  id: string;
  isEnrolled: boolean;
  publishedVersion: {
    checksum: string;
    id: string;
    number: number;
    publishedAt: string;
  };
  slug: string;
  stageCount: number;
  title: string;
}

export interface EnrolledProgramSummary {
  enrollment: {
    enrolledAt: string;
    id: string;
    status: ProgramEnrollmentStatus;
    updatedAt: string;
    withdrawnAt: string | null;
  };
  program: {
    description: string;
    estimatedDurationDays: number | null;
    icon: string | null;
    id: string;
    publishedVersion: {
      checksum: string;
      id: string;
      number: number;
      publishedAt: string;
    };
    slug: string;
    title: string;
  };
  progress: {
    completedAt: string | null;
    lastViewedAt: string;
    percent: number;
    startedAt: string | null;
    targetEndAt: string | null;
  } | null;
}

export interface ProgramDirectoryService {
  listCatalog(input: {
    cursor?: string;
    pageSize: number;
    search?: string;
    userId: string;
  }): Promise<ProgramDirectoryPage<CatalogProgramSummary>>;
  listEnrolled(input: {
    cursor?: string;
    pageSize: number;
    search?: string;
    status: ProgramEnrollmentStatus;
    userId: string;
  }): Promise<ProgramDirectoryPage<EnrolledProgramSummary>>;
}

export function normalizeProgramSearch(search: string | undefined) {
  const normalized = search?.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidProgramDirectoryCursorError();
  }
}

function parseCatalogCursor(cursor: string | undefined, search?: string) {
  if (!cursor) return undefined;
  const parsed = catalogCursorSchema.safeParse(decodeCursor(cursor));
  if (!parsed.success || parsed.data.search !== (search ?? null)) {
    throw new InvalidProgramDirectoryCursorError();
  }
  return parsed.data;
}

function parseEnrolledCursor(
  cursor: string | undefined,
  search: string | undefined,
  status: ProgramEnrollmentStatus,
) {
  if (!cursor) return undefined;
  const parsed = enrolledCursorSchema.safeParse(decodeCursor(cursor));
  if (
    !parsed.success ||
    parsed.data.search !== (search ?? null) ||
    parsed.data.status !== status
  ) {
    throw new InvalidProgramDirectoryCursorError();
  }
  return parsed.data;
}

const catalogSelect = {
  _count: { select: { stages: { where: { isPublished: true } } } },
  description: true,
  enrollments: {
    select: { id: true },
    take: 1,
    where: { status: ProgramEnrollmentStatus.ACTIVE },
  },
  estimatedDurationDays: true,
  icon: true,
  id: true,
  position: true,
  publishedVersion: {
    select: {
      checksum: true,
      id: true,
      publishedAt: true,
      version: true,
    },
  },
  slug: true,
  title: true,
} satisfies Prisma.ProgramSelect;

type CatalogRecord = Prisma.ProgramGetPayload<{ select: typeof catalogSelect }>;

const enrolledSelect = {
  enrolledAt: true,
  id: true,
  program: {
    select: {
      description: true,
      estimatedDurationDays: true,
      icon: true,
      id: true,
      progress: {
        select: {
          completedAt: true,
          lastViewedAt: true,
          percent: true,
          startedAt: true,
          targetEndAt: true,
        },
        take: 1,
      },
      publishedVersion: {
        select: {
          checksum: true,
          id: true,
          publishedAt: true,
          version: true,
        },
      },
      slug: true,
      title: true,
    },
  },
  status: true,
  updatedAt: true,
  withdrawnAt: true,
} satisfies Prisma.ProgramEnrollmentSelect;

type EnrolledRecord = Prisma.ProgramEnrollmentGetPayload<{
  select: typeof enrolledSelect;
}>;

function serializeCatalogProgram(record: CatalogRecord): CatalogProgramSummary {
  if (!record.publishedVersion) {
    throw new Error('Catalog program has no published version.');
  }
  return {
    description: record.description,
    estimatedDurationDays: record.estimatedDurationDays,
    icon: record.icon,
    id: record.id,
    isEnrolled: record.enrollments.length > 0,
    publishedVersion: {
      checksum: record.publishedVersion.checksum,
      id: record.publishedVersion.id,
      number: record.publishedVersion.version,
      publishedAt: record.publishedVersion.publishedAt.toISOString(),
    },
    slug: record.slug,
    stageCount: record._count.stages,
    title: record.title,
  };
}

function serializeEnrolledProgram(
  record: EnrolledRecord,
): EnrolledProgramSummary {
  if (!record.program.publishedVersion) {
    throw new Error('Enrolled program has no published version.');
  }
  const progress = record.program.progress[0];
  return {
    enrollment: {
      enrolledAt: record.enrolledAt.toISOString(),
      id: record.id,
      status: record.status,
      updatedAt: record.updatedAt.toISOString(),
      withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    },
    program: {
      description: record.program.description,
      estimatedDurationDays: record.program.estimatedDurationDays,
      icon: record.program.icon,
      id: record.program.id,
      publishedVersion: {
        checksum: record.program.publishedVersion.checksum,
        id: record.program.publishedVersion.id,
        number: record.program.publishedVersion.version,
        publishedAt:
          record.program.publishedVersion.publishedAt.toISOString(),
      },
      slug: record.program.slug,
      title: record.program.title,
    },
    progress: progress
      ? {
          completedAt: progress.completedAt?.toISOString() ?? null,
          lastViewedAt: progress.lastViewedAt.toISOString(),
          percent: progress.percent,
          startedAt: progress.startedAt?.toISOString() ?? null,
          targetEndAt: progress.targetEndAt?.toISOString() ?? null,
        }
      : null,
  };
}

export function createPrismaProgramDirectoryService(
  client: PrismaClient,
): ProgramDirectoryService {
  return {
    async listCatalog(input) {
      const search = normalizeProgramSearch(input.search);
      const cursor = parseCatalogCursor(input.cursor, search);
      const records = await client.program.findMany({
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: {
          ...catalogSelect,
          enrollments: {
            ...catalogSelect.enrollments,
            where: {
              status: ProgramEnrollmentStatus.ACTIVE,
              userId: input.userId,
            },
          },
        },
        take: input.pageSize + 1,
        where: {
          publishedVersionId: { not: null },
          status: ProgramStatus.ACTIVE,
          visibility: ProgramVisibility.PUBLIC,
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' } },
                  { description: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(cursor
            ? {
                AND: [
                  {
                    OR: [
                      { position: { gt: cursor.position } },
                      { id: { gt: cursor.id }, position: cursor.position },
                    ],
                  },
                ],
              }
            : {}),
        },
      });
      const pageRecords = records.slice(0, input.pageSize);
      const lastRecord = pageRecords.at(-1);
      return {
        items: pageRecords.map(serializeCatalogProgram),
        nextCursor:
          records.length > input.pageSize && lastRecord
            ? encodeCursor({
                id: lastRecord.id,
                position: lastRecord.position,
                scope: 'catalog',
                search: search ?? null,
                version: 1,
              })
            : null,
      };
    },

    async listEnrolled(input) {
      const search = normalizeProgramSearch(input.search);
      const cursor = parseEnrolledCursor(input.cursor, search, input.status);
      const records = await client.programEnrollment.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: {
          ...enrolledSelect,
          program: {
            select: {
              ...enrolledSelect.program.select,
              progress: {
                ...enrolledSelect.program.select.progress,
                where: { userId: input.userId },
              },
            },
          },
        },
        take: input.pageSize + 1,
        where: {
          status: input.status,
          userId: input.userId,
          ...(search
            ? {
                program: {
                  OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    {
                      description: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              }
            : {}),
          ...(cursor
            ? {
                OR: [
                  { updatedAt: { lt: new Date(cursor.updatedAt) } },
                  {
                    id: { lt: cursor.id },
                    updatedAt: new Date(cursor.updatedAt),
                  },
                ],
              }
            : {}),
        },
      });
      const pageRecords = records.slice(0, input.pageSize);
      const lastRecord = pageRecords.at(-1);
      return {
        items: pageRecords.map(serializeEnrolledProgram),
        nextCursor:
          records.length > input.pageSize && lastRecord
            ? encodeCursor({
                id: lastRecord.id,
                scope: 'enrolled',
                search: search ?? null,
                status: input.status,
                updatedAt: lastRecord.updatedAt.toISOString(),
                version: 1,
              })
            : null,
      };
    },
  };
}
