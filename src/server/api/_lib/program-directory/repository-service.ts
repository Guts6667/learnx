import {
  ProgramEnrollmentStatus,
  ProgramStatus,
  ProgramVisibility,
  type Prisma,
  type PrismaClient,
} from '../../../../../generated/prisma/client.js';
import {
  createCatalogCursor,
  createEnrolledCursor,
  normalizeProgramSearch,
  parseCatalogCursor,
  parseEnrolledCursor,
} from './cursors.js';
import {
  catalogSelect,
  enrolledSelect,
  type CatalogRecord,
  type EnrolledRecord,
} from './query-shapes.js';
import {
  serializeCatalogProgram,
  serializeEnrolledProgram,
} from './serialization.js';
import type {
  CatalogDirectoryInput,
  EnrolledDirectoryInput,
  ProgramDirectoryService,
} from './types.js';

function buildCatalogWhere(
  input: CatalogDirectoryInput,
  search: string | undefined,
  cursor: ReturnType<typeof parseCatalogCursor>,
): Prisma.ProgramWhereInput {
  return {
    locale: input.locale,
    publishedVersionId: { not: null },
    status: ProgramStatus.ACTIVE,
    visibility: ProgramVisibility.PUBLIC,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
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
  };
}

function buildEnrolledWhere(
  input: EnrolledDirectoryInput,
  search: string | undefined,
  cursor: ReturnType<typeof parseEnrolledCursor>,
): Prisma.ProgramEnrollmentWhereInput {
  return {
    status: input.status,
    userId: input.userId,
    ...(search
      ? {
          program: {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                description: {
                  contains: search,
                  mode: 'insensitive' as const,
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
            { id: { lt: cursor.id }, updatedAt: new Date(cursor.updatedAt) },
          ],
        }
      : {}),
  };
}

async function listCatalog(client: PrismaClient, input: CatalogDirectoryInput) {
  const search = normalizeProgramSearch(input.search);
  const cursor = parseCatalogCursor(input.cursor, search, input.locale);
  const records: CatalogRecord[] = await client.program.findMany({
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
    where: buildCatalogWhere(input, search, cursor),
  });
  const pageRecords = records.slice(0, input.pageSize);
  const lastRecord = pageRecords.at(-1);
  return {
    items: pageRecords.map(serializeCatalogProgram),
    nextCursor: createCatalogCursor({
      hasNextPage: records.length > input.pageSize,
      id: lastRecord?.id,
      locale: input.locale,
      position: lastRecord?.position,
      search,
    }),
  };
}

async function listEnrolled(
  client: PrismaClient,
  input: EnrolledDirectoryInput,
) {
  const search = normalizeProgramSearch(input.search);
  const cursor = parseEnrolledCursor(input.cursor, search, input.status);
  const records: EnrolledRecord[] = await client.programEnrollment.findMany({
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
    where: buildEnrolledWhere(input, search, cursor),
  });
  const pageRecords = records.slice(0, input.pageSize);
  const lastRecord = pageRecords.at(-1);
  return {
    items: pageRecords.map(serializeEnrolledProgram),
    nextCursor: createEnrolledCursor({
      hasNextPage: records.length > input.pageSize,
      id: lastRecord?.id,
      search,
      status: input.status,
      updatedAt: lastRecord?.updatedAt,
    }),
  };
}

export function createPrismaProgramDirectoryService(
  client: PrismaClient,
): ProgramDirectoryService {
  return {
    listCatalog: (input) => listCatalog(client, input),
    listEnrolled: (input) => listEnrolled(client, input),
  };
}
