import { createAccountErasureService } from './account-erasure-service';

const USER_ID = '6ce94140-7435-426a-9753-90faebc7695a';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const UPDATED_AT = new Date('2026-08-29T10:00:00.000Z');

function build(user: unknown, updateCount = 1) {
  const calls: string[] = [];
  const record = (name: string, result: unknown) => async (input?: unknown) => {
    calls.push(name);
    void input;
    return result;
  };
  const updates: Record<string, unknown>[] = [];
  const wheres: unknown[] = [];
  const transaction = {
    auditEvent: { upsert: vi.fn(record('auditEvent.upsert', {})) },
    exerciseSubmission: {
      updateMany: vi.fn(record('exerciseSubmission.updateMany', { count: 0 })),
    },
    note: { deleteMany: vi.fn(record('note.deleteMany', { count: 2 })) },
    session: { deleteMany: vi.fn(record('session.deleteMany', { count: 1 })) },
    stageAssessmentSubmission: {
      updateMany: vi.fn(
        record('stageAssessmentSubmission.updateMany', { count: 0 }),
      ),
    },
    user: {
      findUnique: vi.fn(record('user.findUnique', user)),
      updateMany: vi.fn(
        async (input: { data: Record<string, unknown>; where: unknown }) => {
          calls.push('user.updateMany');
          updates.push(input.data);
          wheres.push(input.where);
          return { count: updateCount };
        },
      ),
    },
  };
  const client = {
    $transaction: async (fn: (t: unknown) => unknown) => fn(transaction),
  };
  return {
    calls,
    service: createAccountErasureService(client as never),
    transaction,
    updates,
    wheres,
  };
}

const active = {
  accountStatus: 'ACTIVE',
  id: USER_ID,
  updatedAt: UPDATED_AT,
};

function erase(service: ReturnType<typeof build>['service']) {
  return service.erase({
    actorUserId: ACTOR_ID,
    expectedUpdatedAt: UPDATED_AT,
    userId: USER_ID,
  });
}

describe('effacement de compte par pseudonymisation', () => {
  it('détruit l’identité directe et rend le compte inconnectable', async () => {
    const { service, updates } = build(active);
    await expect(erase(service)).resolves.toEqual({ kind: 'ERASED' });

    const [data] = updates;
    expect(data).toMatchObject({
      accountStatus: 'PSEUDONYMISED',
      displayName: 'Compte supprimé',
      email: `deleted+${USER_ID}@accounts.invalid`,
    });
    // No password hashes to this value, so the account cannot be signed into
    // even by someone who knew the replaced address.
    expect(String(data?.passwordHash)).toMatch(/^erased:/);
  });

  it('n’écrase que la ligne lue, telle qu’elle a été lue', async () => {
    // The write is conditioned on the row not having moved since it was read.
    // Without it, an erasure could overwrite a change an administrator never
    // saw — on an action nothing can undo.
    const { service, wheres } = build(active);
    await erase(service);
    expect(wheres).toEqual([{ id: USER_ID, updatedAt: UPDATED_AT }]);
  });

  it('révoque les sessions et supprime les notes privées', async () => {
    const { service, transaction } = build(active);
    await erase(service);
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(transaction.note.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it('conserve les réponses de l’apprenant, décision du propriétaire', async () => {
    // owner-erasure-2026-08-29. The texts survive under the pseudonym, which
    // is why the word everywhere is pseudonymisation: they may still identify
    // the person who wrote them.
    const { service, transaction } = build(active);
    await erase(service);
    expect(transaction.exerciseSubmission.updateMany).not.toHaveBeenCalled();
    expect(
      transaction.stageAssessmentSubmission.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('inscrit la politique appliquée dans l’audit', async () => {
    // A record made under one policy must never be read as though it were made
    // under a later one.
    const { service, transaction } = build(active);
    await erase(service);
    const audit = transaction.auditEvent.upsert.mock.calls[0]?.[0] as {
      create: { metadata: Record<string, unknown> };
    };
    expect(audit.create.metadata).toMatchObject({
      fromStatus: 'ACTIVE',
      learnerTextPolicy: 'RETAINED_UNDER_PSEUDONYM',
    });
  });

  it('ne réefface pas un compte déjà effacé', async () => {
    const { calls, service } = build({
      ...active,
      accountStatus: 'PSEUDONYMISED',
    });
    await expect(erase(service)).resolves.toEqual({ kind: 'ALREADY_ERASED' });
    // Nothing written: a second erasure would overwrite the first audit trail
    // with a record of an act that did not happen.
    expect(calls).toEqual(['user.findUnique']);
  });

  it('refuse quand le compte a changé entre lecture et action', async () => {
    const { calls, service } = build(active, 0);
    await expect(erase(service)).resolves.toEqual({ kind: 'CONFLICT' });
    expect(calls).not.toContain('session.deleteMany');
    expect(calls).not.toContain('note.deleteMany');
  });

  it('renvoie introuvable sur un compte inexistant', async () => {
    const { service } = build(null);
    await expect(erase(service)).resolves.toEqual({ kind: 'NOT_FOUND' });
  });
});
