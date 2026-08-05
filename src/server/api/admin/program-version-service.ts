import { createHash } from 'node:crypto';

import {
  Prisma,
  ProgramStatus,
} from '../../../../generated/prisma/client.js';

const programSnapshotInclude = {
  stages: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    include: {
      assessments: {
        orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
      },
      modules: {
        orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
        include: {
          lessons: {
            orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
            include: {
              concepts: {
                orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
                include: {
                  assessments: {
                    orderBy: [
                      { position: 'asc' as const },
                      { id: 'asc' as const },
                    ],
                    include: {
                      questions: {
                        orderBy: [
                          { position: 'asc' as const },
                          { id: 'asc' as const },
                        ],
                        include: {
                          options: {
                            orderBy: [
                              { position: 'asc' as const },
                              { id: 'asc' as const },
                            ],
                          },
                        },
                      },
                    },
                  },
                  resources: {
                    orderBy: [{ resourceId: 'asc' as const }],
                    select: { id: true, resourceId: true },
                  },
                },
              },
              contentBlocks: {
                orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
              },
              exercises: {
                orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
              },
              quizzes: {
                orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
                include: {
                  questions: {
                    orderBy: [
                      { position: 'asc' as const },
                      { id: 'asc' as const },
                    ],
                    include: {
                      options: {
                        orderBy: [
                          { position: 'asc' as const },
                          { id: 'asc' as const },
                        ],
                      },
                    },
                  },
                },
              },
              resources: {
                orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
              },
              tasks: {
                orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
                include: {
                  resources: {
                    orderBy: [{ resourceId: 'asc' as const }],
                    select: { resourceId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProgramInclude;

type JsonValue = boolean | null | number | string | JsonValue[] | JsonObject;
interface JsonObject {
  [key: string]: JsonValue;
}

const volatileKeys = new Set([
  'createdAt',
  'publishedVersionId',
  'updatedAt',
]);

function normalizeSnapshotValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !volatileKeys.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeSnapshotValue(child)]),
    );
  }
  throw new Error(`Unsupported program snapshot value: ${typeof value}`);
}

export function createCanonicalProgramSnapshot(value: unknown): {
  checksum: string;
  snapshot: Prisma.InputJsonValue;
} {
  const snapshot = {
    program: normalizeSnapshotValue(value),
    schemaVersion: 1,
  } satisfies JsonObject;
  const canonical = JSON.stringify(snapshot);
  return {
    checksum: createHash('sha256').update(canonical).digest('hex'),
    snapshot: JSON.parse(canonical) as Prisma.InputJsonValue,
  };
}

export interface PublishedProgramVersion {
  checksum: string;
  id: string;
  publishedAt: Date;
  version: number;
}

export async function createOrReusePublishedProgramVersion(
  transaction: Prisma.TransactionClient,
  programId: string,
  publishedByUserId: string,
): Promise<PublishedProgramVersion | null> {
  const program = await transaction.program.findFirst({
    where: { id: programId, status: ProgramStatus.ACTIVE },
    include: programSnapshotInclude,
  });
  if (!program) return null;

  const { checksum, snapshot } = createCanonicalProgramSnapshot(program);
  const existing = await transaction.programVersion.findUnique({
    where: { programId_checksum: { checksum, programId } },
    select: { checksum: true, id: true, publishedAt: true, version: true },
  });
  if (existing) {
    await transaction.program.update({
      where: { id: programId },
      data: { publishedVersionId: existing.id },
    });
    return existing;
  }

  const latest = await transaction.programVersion.findFirst({
    where: { programId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = await transaction.programVersion.create({
    data: {
      checksum,
      programId,
      publishedByUserId,
      snapshot,
      version: (latest?.version ?? 0) + 1,
    },
    select: { checksum: true, id: true, publishedAt: true, version: true },
  });
  await transaction.program.update({
    where: { id: programId },
    data: { publishedVersionId: version.id },
  });
  return version;
}
