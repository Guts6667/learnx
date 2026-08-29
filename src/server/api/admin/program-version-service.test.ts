import type { Prisma } from '../../../../generated/prisma/client';
import {
  createCanonicalProgramSnapshot,
  createOrReusePublishedProgramVersion,
} from './program-version-service';

const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const publisherId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';

describe('program versions', () => {
  it('produit un checksum canonique indépendant des timestamps et de l’ordre des clés', () => {
    const first = createCanonicalProgramSnapshot({
      id: programId,
      title: 'Programme',
      updatedAt: new Date('2026-08-05T10:00:00.000Z'),
      stages: [{ id: 'stage-1', position: 1, title: 'Étape' }],
    });
    const second = createCanonicalProgramSnapshot({
      stages: [{ title: 'Étape', position: 1, id: 'stage-1' }],
      updatedAt: new Date('2026-08-05T11:00:00.000Z'),
      title: 'Programme',
      id: programId,
    });

    expect(second.checksum).toBe(first.checksum);
    expect(second.snapshot).toEqual(first.snapshot);
  });

  it('versionne séparément la langue et l’identité canonique du programme', () => {
    const french = createCanonicalProgramSnapshot({
      canonicalProgramKey: 'psychology-foundations',
      id: programId,
      locale: 'fr',
      stages: [],
      title: 'Fondamentaux de la psychologie',
    });
    const english = createCanonicalProgramSnapshot({
      canonicalProgramKey: 'psychology-foundations',
      id: programId,
      locale: 'en',
      stages: [],
      title: 'Psychology Foundations',
    });

    expect(french.snapshot).toMatchObject({
      program: {
        canonicalProgramKey: 'psychology-foundations',
        locale: 'fr',
      },
    });
    expect(english.checksum).not.toBe(french.checksum);
  });

  it('réutilise une version identique et incrémente après une modification réelle', async () => {
    let title = 'Programme initial';
    let currentVersionId: string | null = null;
    const versions: Array<{
      checksum: string;
      id: string;
      publishedAt: Date;
      version: number;
    }> = [];
    const transaction = {
      program: {
        findFirst: vi.fn(async () => ({
          id: programId,
          status: 'ACTIVE',
          stages: [],
          title,
        })),
        update: vi.fn(
          async ({ data }: { data: { publishedVersionId: string } }) => {
            currentVersionId = data.publishedVersionId;
          },
        ),
      },
      programVersion: {
        create: vi.fn(
          async ({ data }: { data: { checksum: string; version: number } }) => {
            const version = {
              checksum: data.checksum,
              id: `version-${data.version}`,
              publishedAt: new Date('2026-08-05T10:00:00.000Z'),
              version: data.version,
            };
            versions.push(version);
            return version;
          },
        ),
        findFirst: vi.fn(async () =>
          versions.length === 0
            ? null
            : { version: versions[versions.length - 1].version },
        ),
        findUnique: vi.fn(
          async ({
            where,
          }: {
            where: { programId_checksum: { checksum: string } };
          }) =>
            versions.find(
              (version) =>
                version.checksum === where.programId_checksum.checksum,
            ) ?? null,
        ),
      },
    } as unknown as Prisma.TransactionClient;

    const first = await createOrReusePublishedProgramVersion(
      transaction,
      programId,
      publisherId,
    );
    const retry = await createOrReusePublishedProgramVersion(
      transaction,
      programId,
      publisherId,
    );
    title = 'Programme corrigé';
    const second = await createOrReusePublishedProgramVersion(
      transaction,
      programId,
      publisherId,
    );

    expect(first?.version).toBe(1);
    expect(retry?.id).toBe(first?.id);
    expect(second?.version).toBe(2);
    expect(versions).toHaveLength(2);
    expect(currentVersionId).toBe('version-2');
  });

  it('ne crée aucune version pour un programme qui n’est pas publié', async () => {
    const transaction = {
      program: { findFirst: vi.fn(async () => null) },
      programVersion: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      createOrReusePublishedProgramVersion(transaction, programId, publisherId),
    ).resolves.toBeNull();
    expect(transaction.programVersion.create).not.toHaveBeenCalled();
  });
});
