import {
  Prisma,
  type PrismaClient,
  ProgramEnrollmentStatus,
  ProgramStatus,
  ProgramVisibility,
} from '../../../../generated/prisma/client.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

export interface ProgramEnrollmentSummary {
  enrolledAt: Date;
  id: string;
  programId: string;
  status: ProgramEnrollmentStatus;
  userId: string;
  version: {
    checksum: string;
    id: string;
    number: number;
  };
  withdrawnAt: Date | null;
}

export interface ProgramEnrollmentService {
  enroll(
    userId: string,
    programId: string,
  ): Promise<ProgramEnrollmentSummary | null>;
  withdraw(
    userId: string,
    programId: string,
  ): Promise<ProgramEnrollmentSummary | null>;
}

const enrollmentInclude = {
  programVersion: {
    select: { checksum: true, id: true, version: true },
  },
} satisfies Prisma.ProgramEnrollmentInclude;

type EnrollmentRecord = Prisma.ProgramEnrollmentGetPayload<{
  include: typeof enrollmentInclude;
}>;

function serializeEnrollment(
  enrollment: EnrollmentRecord,
): ProgramEnrollmentSummary {
  return {
    enrolledAt: enrollment.enrolledAt,
    id: enrollment.id,
    programId: enrollment.programId,
    status: enrollment.status,
    userId: enrollment.userId,
    version: {
      checksum: enrollment.programVersion.checksum,
      id: enrollment.programVersion.id,
      number: enrollment.programVersion.version,
    },
    withdrawnAt: enrollment.withdrawnAt,
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

async function runSerializableTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new Error('Program enrollment transaction retry limit reached.');
}

export function createPrismaProgramEnrollmentService(
  client: PrismaClient,
  dependencies: { now?: () => Date } = {},
): ProgramEnrollmentService {
  const now = dependencies.now ?? (() => new Date());

  return {
    async enroll(userId, programId) {
      return runSerializableTransaction(client, async (transaction) => {
        const program = await transaction.program.findFirst({
          where: {
            id: programId,
            publishedVersionId: { not: null },
            status: ProgramStatus.ACTIVE,
            visibility: ProgramVisibility.PUBLIC,
          },
          select: { id: true, publishedVersionId: true },
        });
        if (!program?.publishedVersionId) return null;

        const enrollment = await transaction.programEnrollment.upsert({
          where: { userId_programId: { programId, userId } },
          create: {
            programId,
            programVersionId: program.publishedVersionId,
            status: ProgramEnrollmentStatus.ACTIVE,
            userId,
          },
          update: {
            status: ProgramEnrollmentStatus.ACTIVE,
            withdrawnAt: null,
          },
          include: enrollmentInclude,
        });

        return serializeEnrollment(enrollment);
      });
    },

    async withdraw(userId, programId) {
      return runSerializableTransaction(client, async (transaction) => {
        await transaction.programEnrollment.updateMany({
          where: {
            programId,
            status: ProgramEnrollmentStatus.ACTIVE,
            userId,
          },
          data: {
            status: ProgramEnrollmentStatus.WITHDRAWN,
            withdrawnAt: now(),
          },
        });
        const enrollment = await transaction.programEnrollment.findUnique({
          where: { userId_programId: { programId, userId } },
          include: enrollmentInclude,
        });

        return enrollment ? serializeEnrollment(enrollment) : null;
      });
    },
  };
}
