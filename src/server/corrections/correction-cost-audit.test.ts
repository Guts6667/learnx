import {
  PrismaCorrectionCostAudit,
  costAuditExitCode,
} from './correction-cost-audit';

interface AlertMessage {
  facts: string[];
  headline: string;
  idempotencyKey: string;
}

const NOW = new Date('2026-08-29T12:00:00.000Z');

function audit(attempts: unknown[], withAlert = true) {
  const findMany = vi.fn(async () => attempts);
  const sent: AlertMessage[] = [];
  const send = vi.fn(async (input: AlertMessage) => {
    sent.push(input);
  });
  return {
    findMany,
    send,
    sent,
    service: new PrismaCorrectionCostAudit(
      { aiCorrectionAttempt: { findMany } } as never,
      withAlert ? { send } : undefined,
      () => NOW,
    ),
  };
}

const attempt = {
  aiCorrectionId: 'correction-1',
  createdAt: new Date('2026-08-29T11:00:00.000Z'),
  id: 'attempt-1',
  providerRequestId: 'generation-1',
  status: 'FAILED',
};

/** Still marked running two hours after it started: stuck, not in flight. */
const stuck = {
  ...attempt,
  createdAt: new Date('2026-08-29T10:00:00.000Z'),
  id: 'attempt-stuck',
  status: 'PROCESSING',
};

describe('PrismaCorrectionCostAudit', () => {
  it('borne la fenêtre à 24 h et n’exclut que les tentatives récemment en cours', async () => {
    // A PROCESSING attempt under an hour old is running, and alerting on it
    // would fire during healthy operation. Beyond that it is stuck, and its
    // missing cost is exactly the kind we want to hear about.
    const { findMany, service } = audit([]);
    await service.report();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          costUsd: null,
          createdAt: {
            gte: new Date('2026-08-28T12:00:00.000Z'),
            lte: NOW,
          },
          OR: [
            { status: { not: 'PROCESSING' } },
            {
              createdAt: { lt: new Date('2026-08-29T11:00:00.000Z') },
              status: 'PROCESSING',
            },
          ],
        },
      }),
    );
  });

  it('distingue une tentative terminée d’une tentative bloquée', async () => {
    const { service } = audit([attempt, stuck]);
    const report = await service.report();
    expect(report.attempts.map((item) => item.kind)).toEqual([
      'FINISHED',
      'STUCK_PROCESSING',
    ]);
  });

  it('n’alerte pas quand il n’y a rien à signaler', async () => {
    const { send, service } = audit([]);
    await service.reportAndAlert();
    expect(send).not.toHaveBeenCalled();
  });

  it('alerte avec des identifiants et jamais de contenu', async () => {
    const { sent, service } = audit([attempt]);
    const report = await service.reportAndAlert();

    expect(report.attempts).toEqual([
      {
        attemptId: 'attempt-1',
        correctionId: 'correction-1',
        kind: 'FINISHED',
        providerRequestId: 'generation-1',
      },
    ]);
    const message = sent[0] as AlertMessage;
    expect(message.facts.join(' ')).toContain('correction-1');
    // The reader has to know which kind of unknown they are looking at.
    expect(message.facts.join(' ')).toContain('FINISHED');
    expect(message.facts.join(' ')).toContain('Aucune écriture automatique');
  });

  it('n’écrit rien, jamais', async () => {
    // The whole point: an accounting gap on our side must not change what a
    // learner can do with a correction they already received.
    const update = vi.fn();
    const service = new PrismaCorrectionCostAudit(
      {
        aiCorrection: { update },
        aiCorrectionAttempt: { findMany: vi.fn(async () => [attempt]), update },
      } as never,
      { send: vi.fn(async () => undefined) },
      () => NOW,
    );
    await service.reportAndAlert();
    expect(update).not.toHaveBeenCalled();
  });

  it('groupe l’alerte par heure pour ne pas la répéter à chaque passage', async () => {
    const { sent, service } = audit([attempt]);
    await service.reportAndAlert();
    expect((sent[0] as AlertMessage).idempotencyKey).toBe(
      'unknown-cost-2026-08-29T12',
    );
  });
});

describe('costAuditExitCode', () => {
  it.each([
    ['rien à signaler, canal présent', 0, true, 0],
    ['rien à signaler, aucun canal', 0, false, 0],
    ['signalements envoyés', 3, true, 0],
    ['signalements sans destinataire', 3, false, 1],
  ])('%s', (_label, attempts, hasAlertChannel, expected) => {
    // Findings are news, not a broken job. Findings nobody can be told about
    // are: the scheduler is then the only thing that can raise a hand.
    expect(costAuditExitCode({ attempts, hasAlertChannel })).toBe(expected);
  });
});

describe('PrismaCorrectionCostAudit sans canal', () => {
  it('rapporte sans lever quand aucun canal n’est configuré', async () => {
    const { service } = audit([attempt], false);
    await expect(service.reportAndAlert()).resolves.toMatchObject({
      attempts: [expect.objectContaining({ attemptId: 'attempt-1' })],
    });
  });
});
