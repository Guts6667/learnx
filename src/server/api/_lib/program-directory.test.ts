import {
  ProgramEnrollmentStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  createPrismaProgramDirectoryService,
  InvalidProgramDirectoryCursorError,
  normalizeProgramSearch,
} from './program-directory/index.js';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const programId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const secondProgramId = 'e54ae785-0d74-4a13-9e0c-f90675f9dd29';
const versionId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const enrollmentId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const now = new Date('2026-08-05T10:00:00.000Z');

function catalogRecord(id: string, position: number) {
  return {
    _count: { stages: 3 },
    canonicalProgramKey: 'programme-canonique',
    description: 'Programme partagé',
    enrollments: id === programId ? [{ id: enrollmentId }] : [],
    estimatedDurationDays: 30,
    icon: null,
    id,
    locale: 'fr',
    position,
    publishedVersion: {
      checksum: 'checksum',
      id: versionId,
      publishedAt: now,
      version: 1,
    },
    slug: `programme-${position}`,
    title: `Programme ${position}`,
  };
}

function enrolledRecord() {
  return {
    enrolledAt: now,
    id: enrollmentId,
    program: {
      canonicalProgramKey: 'programme-canonique',
      description: 'Programme suivi',
      estimatedDurationDays: 30,
      icon: null,
      id: programId,
      locale: 'fr',
      progress: [
        {
          completedAt: null,
          lastViewedAt: now,
          percent: 25,
          startedAt: now,
          targetEndAt: null,
        },
      ],
      publishedVersion: {
        checksum: 'checksum',
        id: versionId,
        publishedAt: now,
        version: 1,
      },
      slug: 'programme-suivi',
      title: 'Programme suivi',
    },
    status: ProgramEnrollmentStatus.ACTIVE,
    updatedAt: now,
    withdrawnAt: null,
  };
}

describe('program directory service', () => {
  it('normalise la recherche et ne renvoie que le catalogue publiable', async () => {
    const findMany = vi.fn().mockResolvedValue([catalogRecord(programId, 1)]);
    const service = createPrismaProgramDirectoryService({
      program: { findMany },
      programEnrollment: { findMany: vi.fn() },
    } as unknown as PrismaClient);

    const page = await service.listCatalog({
      locale: 'fr',
      pageSize: 20,
      search: '  psychologie   scientifique ',
      userId,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      canonicalProgramKey: 'programme-canonique',
      id: programId,
      isEnrolled: true,
      locale: 'fr',
      stageCount: 3,
    });
    expect(page.items[0]).not.toHaveProperty('progress');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 21,
        where: expect.objectContaining({
          locale: 'fr',
          publishedVersionId: { not: null },
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          OR: expect.arrayContaining([
            {
              title: {
                contains: 'psychologie scientifique',
                mode: 'insensitive',
              },
            },
          ]),
        }),
      }),
    );
    const select = findMany.mock.calls[0]?.[0].select;
    expect(select.enrollments.where).toEqual({
      status: ProgramEnrollmentStatus.ACTIVE,
      userId,
    });
  });

  it('produit un curseur stable et refuse sa réutilisation avec une autre recherche', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        catalogRecord(programId, 1),
        catalogRecord(secondProgramId, 2),
      ])
      .mockResolvedValueOnce([catalogRecord(secondProgramId, 2)]);
    const service = createPrismaProgramDirectoryService({
      program: { findMany },
      programEnrollment: { findMany: vi.fn() },
    } as unknown as PrismaClient);

    const firstPage = await service.listCatalog({
      locale: 'fr',
      pageSize: 1,
      userId,
    });
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const secondPage = await service.listCatalog({
      cursor: firstPage.nextCursor ?? undefined,
      locale: 'fr',
      pageSize: 1,
      userId,
    });
    expect(secondPage.items[0]?.id).toBe(secondProgramId);
    expect(findMany.mock.calls[1]?.[0].where.AND).toEqual([
      {
        OR: [{ position: { gt: 1 } }, { id: { gt: programId }, position: 1 }],
      },
    ]);

    await expect(
      service.listCatalog({
        cursor: firstPage.nextCursor ?? undefined,
        locale: 'fr',
        pageSize: 1,
        search: 'autre',
        userId,
      }),
    ).rejects.toBeInstanceOf(InvalidProgramDirectoryCursorError);
    await expect(
      service.listCatalog({
        cursor: 'not-a-cursor',
        locale: 'fr',
        pageSize: 1,
        userId,
      }),
    ).rejects.toBeInstanceOf(InvalidProgramDirectoryCursorError);
    await expect(
      service.listCatalog({
        cursor: firstPage.nextCursor ?? undefined,
        locale: 'en',
        pageSize: 1,
        userId,
      }),
    ).rejects.toBeInstanceOf(InvalidProgramDirectoryCursorError);
  });

  it('scope Mes programmes au compte, au statut et à sa seule progression', async () => {
    const findMany = vi.fn().mockResolvedValue([enrolledRecord()]);
    const service = createPrismaProgramDirectoryService({
      program: { findMany: vi.fn() },
      programEnrollment: { findMany },
    } as unknown as PrismaClient);

    const page = await service.listEnrolled({
      pageSize: 10,
      search: ' suivi ',
      status: ProgramEnrollmentStatus.ACTIVE,
      userId,
    });

    expect(page.items[0]?.progress?.percent).toBe(25);
    expect(page.items[0]?.program).toMatchObject({
      canonicalProgramKey: 'programme-canonique',
      locale: 'fr',
    });
    expect(page.items[0]?.enrollment.status).toBe('ACTIVE');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 11,
        where: expect.objectContaining({
          status: ProgramEnrollmentStatus.ACTIVE,
          userId,
        }),
      }),
    );
    const progress = findMany.mock.calls[0]?.[0].select.program.select.progress;
    expect(progress.where).toEqual({ userId });
  });

  it('normalise les espaces vides sans créer de filtre', () => {
    expect(normalizeProgramSearch('   ')).toBeUndefined();
  });
});
