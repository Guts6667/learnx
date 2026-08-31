import { Prisma } from '../../../../generated/prisma/client';

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
    aiCorrection: {
      findMany: vi.fn(record('aiCorrection.findMany', [])),
      update: vi.fn(record('aiCorrection.update', {})),
      updateMany: vi.fn(record('aiCorrection.updateMany', { count: 0 })),
    },
    aiCorrectionAttempt: {
      findMany: vi.fn(record('aiCorrectionAttempt.findMany', [])),
      update: vi.fn(record('aiCorrectionAttempt.update', {})),
      updateMany: vi.fn(record('aiCorrectionAttempt.updateMany', { count: 0 })),
    },
    auditEvent: { upsert: vi.fn(record('auditEvent.upsert', {})) },
    exerciseSubmission: {
      updateMany: vi.fn(record('exerciseSubmission.updateMany', { count: 0 })),
    },
    note: { deleteMany: vi.fn(record('note.deleteMany', { count: 2 })) },
    paymentEvent: {
      updateMany: vi.fn(record('paymentEvent.updateMany', { count: 3 })),
    },
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

/** A consenti à la conservation : le comportement d'origine s'applique. */
const active = {
  accountStatus: 'ACTIVE',
  correctionReuseConsent: true,
  id: USER_ID,
  updatedAt: UPDATED_AT,
};

/** N'a rien autorisé — le réglage par défaut (V4.5-216). */
const activeWithoutConsent = { ...active, correctionReuseConsent: false };

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

  it('vide le corps des événements de paiement de cette personne', async () => {
    // V4.5-197, `owner-e4-2026-08-30`. Pseudonymising the account does not
    // reach the provider's raw bodies, and those carry `customer_details` —
    // e-mail, name, phone, billing address — exactly the direct identity this
    // service exists to destroy. Retention gets there at thirty days; an
    // erasure request cannot be asked to wait out that window.
    const { service, transaction } = build(active);
    await erase(service);
    expect(transaction.paymentEvent.updateMany).toHaveBeenCalledWith({
      data: { payload: Prisma.DbNull },
      where: {
        order: { userId: USER_ID },
        payload: { not: Prisma.DbNull },
      },
    });
  });

  it('vide sans supprimer : la trace comptable survit à l’effacement', async () => {
    // The rows stay, attached to an order whose user no longer names anyone.
    const { calls, service } = build(active);
    await erase(service);
    expect(calls).toContain('paymentEvent.updateMany');
    expect(calls).not.toContain('paymentEvent.deleteMany');
    expect(calls).not.toContain('paymentOrder.deleteMany');
  });

  it('ne touche à rien quand le compte a changé sous nous', async () => {
    const { calls, service } = build(active, 0);
    await expect(erase(service)).resolves.toEqual({ kind: 'CONFLICT' });
    expect(calls).not.toContain('paymentEvent.updateMany');
  });

  it('conserve les réponses quand l’apprenant a autorisé la conservation', async () => {
    // owner-erasure-2026-08-29. The texts survive under the pseudonym, which
    // is why the word everywhere is pseudonymisation: they may still identify
    // the person who wrote them. Inchangé par V4.5-216 : seul le cas SANS
    // consentement change.
    const { service, transaction } = build(active);
    await erase(service);
    expect(transaction.exerciseSubmission.updateMany).not.toHaveBeenCalled();
    expect(
      transaction.stageAssessmentSubmission.updateMany,
    ).not.toHaveBeenCalled();
    expect(transaction.aiCorrection.updateMany).not.toHaveBeenCalled();
    expect(transaction.aiCorrectionAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('supprime les textes quand l’apprenant n’a rien autorisé', async () => {
    // V4.5-216. Un apprenant qui a refusé la réutilisation voyait ses textes
    // conservés s'il supprimait son compte, alors que le détachement à 180
    // jours les aurait supprimés : le chemin le plus explicite était le moins
    // respectueux du choix exprimé.
    const { service, transaction } = build(activeWithoutConsent);

    await expect(erase(service)).resolves.toEqual({ kind: 'ERASED' });

    expect(transaction.exerciseSubmission.updateMany).toHaveBeenCalled();
    expect(transaction.stageAssessmentSubmission.updateMany).toHaveBeenCalled();
    expect(transaction.aiCorrection.updateMany).toHaveBeenCalled();
    expect(transaction.aiCorrectionAttempt.updateMany).toHaveBeenCalled();
  });

  it('ne touche à aucune ligne d’argent en supprimant les textes', async () => {
    // Le grand livre n'est jamais réécrit (ADR_003 §6). Les événements de
    // paiement sont vidés par l'effacement lui-même, pas par cette branche,
    // et rien d'autre du côté argent ne bouge.
    const { service, calls } = build(activeWithoutConsent);

    await erase(service);

    expect(
      calls.filter((name) => name.startsWith('creditLedgerEntry')),
    ).toEqual([]);
    expect(calls.filter((name) => name.startsWith('paymentOrder'))).toEqual([]);
  });

  it('retire les citations au milieu du jugement, sans détruire la note', async () => {
    // Le cas qui compte vraiment : `structuredResult` porte les mots de
    // l'apprenant AU MILIEU du jugement. L'annuler effacerait la note avec la
    // citation ; il faut le parcourir. Niveaux et confiances survivent, les
    // citations partent.
    const { service, transaction } = build(activeWithoutConsent);
    transaction.aiCorrection.findMany.mockResolvedValueOnce([
      {
        id: 'correction-1',
        structuredResult: {
          criteria: [
            {
              criterionKey: 'source-fidelity',
              evidenceQuotes: ['une phrase que l’apprenant a écrite'],
              levelKey: 'mastered',
            },
          ],
          overallConfidence: 0.9,
        },
      },
    ]);
    transaction.aiCorrectionAttempt.findMany.mockResolvedValueOnce([
      {
        id: 'attempt-1',
        structuredResult: {
          criteria: [{ evidenceQuotes: ['la même phrase, recopiée'] }],
        },
      },
    ]);

    await erase(service);

    const correctionWrite = transaction.aiCorrection.update.mock
      .calls[0]?.[0] as { data: { structuredResult: unknown } };
    expect(correctionWrite.data.structuredResult).toEqual({
      criteria: [
        {
          criterionKey: 'source-fidelity',
          evidenceQuotes: [],
          levelKey: 'mastered',
        },
      ],
      overallConfidence: 0.9,
    });

    // La tentative porte sa propre copie du jugement : la laisser garderait
    // les mots que ce chemin existe pour retirer.
    const attemptWrite = transaction.aiCorrectionAttempt.update.mock
      .calls[0]?.[0] as { data: { structuredResult: unknown } };
    expect(attemptWrite.data.structuredResult).toEqual({
      criteria: [{ evidenceQuotes: [] }],
    });
  });

  it('inscrit la suppression des textes dans l’audit', async () => {
    // La politique appliquée est celle qui a réellement tourné, pas celle du
    // service : deux comptes effacés le même jour peuvent différer.
    const { service, transaction } = build(activeWithoutConsent);
    await erase(service);
    const audit = transaction.auditEvent.upsert.mock.calls[0]?.[0] as {
      create: { metadata: Record<string, unknown> };
    };
    expect(audit.create.metadata).toMatchObject({
      learnerTextPolicy: 'DELETED_NO_REUSE_CONSENT',
    });
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
