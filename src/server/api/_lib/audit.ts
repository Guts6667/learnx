import {
  type AuditAction,
  type Prisma,
} from '../../../../generated/prisma/client.js';
import { createHash } from 'node:crypto';

type AuditMetadataValue = boolean | number | string | null;
type AuditMetadata = Record<
  string,
  AuditMetadataValue | readonly AuditMetadataValue[]
>;

export interface AuditEventInput {
  action: AuditAction;
  actorUserId: string;
  idempotencyKey: string;
  metadata?: AuditMetadata;
  targetId: string;
  targetType: string;
}

const forbiddenMetadataKey =
  /(?:authorization|cookie|email|password|secret|token)/i;

function assertSafeMetadata(metadata: AuditMetadata): void {
  const unsafeKey = Object.keys(metadata).find((key) =>
    forbiddenMetadataKey.test(key),
  );

  if (unsafeKey) {
    throw new Error(`Unsafe audit metadata key: ${unsafeKey}`);
  }
}

export function createAuditIdempotencyKey(
  action: string,
  targetId: string,
  values: Record<string, unknown>,
): string {
  const canonicalValues = Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );

  return createHash('sha256')
    .update(JSON.stringify([action, targetId, canonicalValues]))
    .digest('hex');
}

export async function writeAuditEvent(
  transaction: Prisma.TransactionClient,
  input: AuditEventInput,
): Promise<void> {
  assertSafeMetadata(input.metadata ?? {});
  await transaction.auditEvent.upsert({
    where: {
      actorUserId_action_idempotencyKey: {
        actorUserId: input.actorUserId,
        action: input.action,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      action: input.action,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      targetId: input.targetId,
      targetType: input.targetType,
    },
    update: {},
  });
}
