import { describe, expect, it, vi } from 'vitest';

import { SYSTEM_ACTOR_ID, ensureSystemActor } from './system-actor';

describe('compte technique (V4.5-203)', () => {
  function client() {
    return { user: { upsert: vi.fn(async () => ({})) } };
  }

  it('crée un compte qui ne peut pas se connecter', async () => {
    // SUSPENDED is not decoration: every session lookup requires ACTIVE, so
    // the guarantee is one that already exists rather than a new promise.
    const prisma = client();

    await expect(ensureSystemActor(prisma as never)).resolves.toBe(
      SYSTEM_ACTOR_ID,
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accountStatus: 'SUSPENDED',
          id: SYSTEM_ACTOR_ID,
        }),
        where: { id: SYSTEM_ACTOR_ID },
      }),
    );
  });

  it('ne touche pas la ligne quand elle existe déjà', async () => {
    // An upsert that wrote on every refund would move `updatedAt` and make an
    // inert account look active.
    const prisma = client();

    await ensureSystemActor(prisma as never);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });

  it('n’emporte aucune donnée personnelle', async () => {
    const prisma = client();

    await ensureSystemActor(prisma as never);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: 'system@accounts.invalid',
          passwordHash: expect.stringMatching(/^system:/) as unknown as string,
        }),
      }),
    );
  });
});
