import { describe, expect, it, vi } from 'vitest';

import {
  type PrismaClient,
  ProgramEnrollmentStatus,
  ProgramStatus,
  ProgramVisibility,
} from '../../../../generated/prisma/client.js';
import { createPrismaProgramEnrollmentService } from './program-enrollment.js';

const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const versionOneId = 'f8e69f67-cbd2-4d68-a4c5-ae97a57d2ddd';
const versionTwoId = 'e9741391-b80e-49db-9985-b318ea17081c';
const userOneId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const userTwoId = 'dce1045c-4a28-4b3f-aed2-148f2f59a250';

interface StoredEnrollment {
  createdAt: Date;
  enrolledAt: Date;
  id: string;
  programId: string;
  programVersion: { checksum: string; id: string; version: number };
  programVersionId: string;
  status: ProgramEnrollmentStatus;
  updatedAt: Date;
  userId: string;
  withdrawnAt: Date | null;
}

function createClient() {
  const enrollments = new Map<string, StoredEnrollment>();
  const versions = new Map([
    [
      versionOneId,
      { checksum: 'a'.repeat(64), id: versionOneId, version: 1 },
    ],
    [
      versionTwoId,
      { checksum: 'b'.repeat(64), id: versionTwoId, version: 2 },
    ],
  ]);
  let available = true;
  let currentVersionId = versionOneId;
  let sequence = 0;

  const transactionClient = {
    program: {
      findFirst: vi.fn(async () =>
        available
          ? { id: programId, publishedVersionId: currentVersionId }
          : null,
      ),
    },
    programEnrollment: {
      findUnique: vi.fn(
        async (input: {
          where: { userId_programId: { programId: string; userId: string } };
        }) =>
          enrollments.get(
            `${input.where.userId_programId.userId}:${input.where.userId_programId.programId}`,
          ) ?? null,
      ),
      updateMany: vi.fn(
        async (input: {
          data: {
            status: ProgramEnrollmentStatus;
            withdrawnAt: Date;
          };
          where: {
            programId: string;
            status: ProgramEnrollmentStatus;
            userId: string;
          };
        }) => {
          const key = `${input.where.userId}:${input.where.programId}`;
          const current = enrollments.get(key);
          if (!current || current.status !== input.where.status) {
            return { count: 0 };
          }
          enrollments.set(key, {
            ...current,
            ...input.data,
            updatedAt: input.data.withdrawnAt,
          });
          return { count: 1 };
        },
      ),
      upsert: vi.fn(
        async (input: {
          create: {
            programId: string;
            programVersionId: string;
            status: ProgramEnrollmentStatus;
            userId: string;
          };
          update: {
            status: ProgramEnrollmentStatus;
            withdrawnAt: null;
          };
          where: { userId_programId: { programId: string; userId: string } };
        }) => {
          const key = `${input.where.userId_programId.userId}:${input.where.userId_programId.programId}`;
          const current = enrollments.get(key);
          if (current) {
            const updated = { ...current, ...input.update };
            enrollments.set(key, updated);
            return updated;
          }

          const timestamp = new Date('2026-08-05T16:00:00.000Z');
          const programVersion = versions.get(input.create.programVersionId);
          if (!programVersion) throw new Error('Unknown program version.');
          sequence += 1;
          const created: StoredEnrollment = {
            ...input.create,
            createdAt: timestamp,
            enrolledAt: timestamp,
            id: `enrollment-${sequence}`,
            programVersion,
            updatedAt: timestamp,
            withdrawnAt: null,
          };
          enrollments.set(key, created);
          return created;
        },
      ),
    },
  };
  const runTransaction = vi.fn(
    async (operation: (transaction: typeof transactionClient) => unknown) =>
      operation(transactionClient),
  );

  return {
    client: { $transaction: runTransaction } as unknown as PrismaClient,
    enrollments,
    runTransaction,
    setAvailable(value: boolean) {
      available = value;
    },
    setCurrentVersion(versionId: string) {
      currentVersionId = versionId;
    },
    transactionClient,
  };
}

describe('program enrollment service', () => {
  it('inscrit deux utilisateurs au même programme sans partager leur état', async () => {
    const { client, transactionClient } = createClient();
    const service = createPrismaProgramEnrollmentService(client);

    const first = await service.enroll(userOneId, programId);
    const second = await service.enroll(userTwoId, programId);

    expect(first).toMatchObject({
      programId,
      status: ProgramEnrollmentStatus.ACTIVE,
      userId: userOneId,
      version: { id: versionOneId, number: 1 },
    });
    expect(second).toMatchObject({
      programId,
      status: ProgramEnrollmentStatus.ACTIVE,
      userId: userTwoId,
      version: { id: versionOneId, number: 1 },
    });
    expect(first?.id).not.toBe(second?.id);
    expect(transactionClient.program.findFirst).toHaveBeenCalledWith({
      where: {
        id: programId,
        publishedVersionId: { not: null },
        status: ProgramStatus.ACTIVE,
        visibility: ProgramVisibility.PUBLIC,
      },
      select: { id: true, publishedVersionId: true },
    });
  });

  it('désinscrit seulement le compte courant et reste idempotent', async () => {
    const withdrawnAt = new Date('2026-08-05T17:00:00.000Z');
    const { client } = createClient();
    const service = createPrismaProgramEnrollmentService(client, {
      now: () => withdrawnAt,
    });
    await service.enroll(userOneId, programId);
    await service.enroll(userTwoId, programId);

    const withdrawn = await service.withdraw(userOneId, programId);
    const repeated = await service.withdraw(userOneId, programId);
    const other = await service.enroll(userTwoId, programId);

    expect(withdrawn).toMatchObject({
      status: ProgramEnrollmentStatus.WITHDRAWN,
      userId: userOneId,
      withdrawnAt,
    });
    expect(repeated).toEqual(withdrawn);
    expect(other).toMatchObject({
      status: ProgramEnrollmentStatus.ACTIVE,
      userId: userTwoId,
      withdrawnAt: null,
    });
  });

  it('réactive la version suivie sans effacer ni remplacer l’inscription', async () => {
    const { client, setCurrentVersion } = createClient();
    const service = createPrismaProgramEnrollmentService(client);
    const initial = await service.enroll(userOneId, programId);
    await service.withdraw(userOneId, programId);
    setCurrentVersion(versionTwoId);

    const reenrolled = await service.enroll(userOneId, programId);

    expect(reenrolled).toMatchObject({
      id: initial?.id,
      status: ProgramEnrollmentStatus.ACTIVE,
      version: { id: versionOneId, number: 1 },
      withdrawnAt: null,
    });
    expect(reenrolled?.enrolledAt).toEqual(initial?.enrolledAt);
  });

  it('refuse une nouvelle inscription lorsque le programme publié est indisponible', async () => {
    const { client, setAvailable } = createClient();
    setAvailable(false);
    const service = createPrismaProgramEnrollmentService(client);

    await expect(service.enroll(userOneId, programId)).resolves.toBeNull();
  });

  it('réessaie une collision concurrente sans créer un second enrollment', async () => {
    const { client, enrollments, runTransaction } = createClient();
    runTransaction.mockRejectedValueOnce({ code: 'P2002' });
    const service = createPrismaProgramEnrollmentService(client);

    const enrollment = await service.enroll(userOneId, programId);

    expect(enrollment).toMatchObject({ userId: userOneId });
    expect(runTransaction).toHaveBeenCalledTimes(2);
    expect(enrollments.size).toBe(1);
  });
});
