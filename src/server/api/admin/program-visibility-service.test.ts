import type { PrismaClient } from '../../../../generated/prisma/client';
import { createPrismaProgramVisibilityService } from './program-visibility-service';

const actorUserId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const expectedUpdatedAt = new Date('2026-08-05T10:00:00.000Z');

function createClient(
  current: {
    id: string;
    status: 'ACTIVE';
    updatedAt: Date;
    visibility: 'PRIVATE' | 'PUBLIC';
  } | null,
) {
  const updatedProgram = current
    ? { ...current, updatedAt: new Date('2026-08-05T10:01:00.000Z') }
    : null;
  const transaction = {
    auditEvent: { upsert: vi.fn(async () => ({})) },
    program: {
      findFirst: vi.fn(async () => current),
      findUniqueOrThrow: vi.fn(async () => updatedProgram),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const client = {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient;

  return { client, transaction };
}

describe('program visibility service', () => {
  it('met à jour atomiquement la visibilité et écrit un audit sans donnée sensible', async () => {
    const { client, transaction } = createClient({
      id: programId,
      status: 'ACTIVE',
      updatedAt: expectedUpdatedAt,
      visibility: 'PRIVATE',
    });
    const service = createPrismaProgramVisibilityService(client);

    const result = await service.update(actorUserId, programId, {
      expectedUpdatedAt,
      visibility: 'PUBLIC',
    });

    expect(result).toMatchObject({ kind: 'SUCCESS' });
    expect(transaction.program.updateMany).toHaveBeenCalledWith({
      data: { visibility: 'PUBLIC' },
      where: {
        id: programId,
        ownerId: actorUserId,
        updatedAt: expectedUpdatedAt,
      },
    });
    expect(transaction.auditEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          action: 'PROGRAM_VISIBILITY_UPDATE',
          metadata: { from: 'PRIVATE', to: 'PUBLIC' },
        }),
      }),
    );
  });

  it('est idempotent quand la visibilité demandée est déjà appliquée', async () => {
    const { client, transaction } = createClient({
      id: programId,
      status: 'ACTIVE',
      updatedAt: expectedUpdatedAt,
      visibility: 'PUBLIC',
    });
    const service = createPrismaProgramVisibilityService(client);

    const result = await service.update(actorUserId, programId, {
      expectedUpdatedAt,
      visibility: 'PUBLIC',
    });

    expect(result).toMatchObject({ kind: 'SUCCESS' });
    expect(transaction.program.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditEvent.upsert).not.toHaveBeenCalled();
  });

  it('refuse une version périmée sans écrire', async () => {
    const { client, transaction } = createClient({
      id: programId,
      status: 'ACTIVE',
      updatedAt: new Date('2026-08-05T10:02:00.000Z'),
      visibility: 'PRIVATE',
    });
    const service = createPrismaProgramVisibilityService(client);

    const result = await service.update(actorUserId, programId, {
      expectedUpdatedAt,
      visibility: 'PUBLIC',
    });

    expect(result).toEqual({ kind: 'CONFLICT' });
    expect(transaction.program.updateMany).not.toHaveBeenCalled();
  });

  it('masque un programme qui n’appartient pas à l’acteur', async () => {
    const { client, transaction } = createClient(null);
    const service = createPrismaProgramVisibilityService(client);

    const result = await service.update(actorUserId, programId, {
      expectedUpdatedAt,
      visibility: 'PUBLIC',
    });

    expect(result).toEqual({ kind: 'NOT_FOUND' });
    expect(transaction.program.updateMany).not.toHaveBeenCalled();
  });
});
