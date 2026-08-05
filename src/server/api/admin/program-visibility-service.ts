import {
  AuditAction,
  type PrismaClient,
  type ProgramVisibility,
} from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';
import { editorialProgramWhere } from '../_lib/program-access-policy.js';

export interface ProgramVisibilityState {
  id: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  updatedAt: Date;
  visibility: ProgramVisibility;
}

export type ProgramVisibilityUpdateResult =
  | { kind: 'CONFLICT' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'SUCCESS'; program: ProgramVisibilityState };

export interface ProgramVisibilityService {
  update(
    actorUserId: string,
    programId: string,
    input: { expectedUpdatedAt: Date; visibility: ProgramVisibility },
  ): Promise<ProgramVisibilityUpdateResult>;
}

const programSelect = {
  id: true,
  status: true,
  updatedAt: true,
  visibility: true,
} as const;

export function createPrismaProgramVisibilityService(
  client: PrismaClient,
): ProgramVisibilityService {
  return {
    async update(actorUserId, programId, input) {
      return client.$transaction(async (transaction) => {
        const current = await transaction.program.findFirst({
          where: {
            id: programId,
            ...editorialProgramWhere(actorUserId),
          },
          select: programSelect,
        });
        if (!current) return { kind: 'NOT_FOUND' };
        if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
          return { kind: 'CONFLICT' };
        }
        if (current.visibility === input.visibility) {
          return { kind: 'SUCCESS', program: current };
        }

        const updated = await transaction.program.updateMany({
          where: {
            id: programId,
            ...editorialProgramWhere(actorUserId),
            updatedAt: input.expectedUpdatedAt,
          },
          data: { visibility: input.visibility },
        });
        if (updated.count !== 1) return { kind: 'CONFLICT' };

        const program = await transaction.program.findUniqueOrThrow({
          where: { id: programId },
          select: programSelect,
        });
        await writeAuditEvent(transaction, {
          action: AuditAction.PROGRAM_VISIBILITY_UPDATE,
          actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.PROGRAM_VISIBILITY_UPDATE,
            programId,
            input,
          ),
          metadata: {
            from: current.visibility,
            to: input.visibility,
          },
          targetId: programId,
          targetType: 'program',
        });

        return { kind: 'SUCCESS', program };
      });
    },
  };
}
