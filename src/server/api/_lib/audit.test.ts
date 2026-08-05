import type { Prisma } from '../../../../generated/prisma/client';

import { createAuditIdempotencyKey, writeAuditEvent } from './audit';

describe('audit events', () => {
  it('builds stable keys regardless of object property order', () => {
    expect(
      createAuditIdempotencyKey('MODULE_UPDATE', 'target', {
        title: 'Titre',
        position: 2,
      }),
    ).toBe(
      createAuditIdempotencyKey('MODULE_UPDATE', 'target', {
        position: 2,
        title: 'Titre',
      }),
    );
  });

  it.each(['email', 'passwordHash', 'sessionToken', 'clientSecret'])(
    'rejects the sensitive metadata key %s',
    async (key) => {
      const upsert = vi.fn();
      await expect(
        writeAuditEvent(
          { auditEvent: { upsert } } as unknown as Prisma.TransactionClient,
          {
            action: 'MODULE_UPDATE',
            actorUserId: 'actor',
            idempotencyKey: 'key',
            metadata: { [key]: 'sensitive' },
            targetId: 'target',
            targetType: 'module',
          },
        ),
      ).rejects.toThrow('Unsafe audit metadata key');
      expect(upsert).not.toHaveBeenCalled();
    },
  );
});
