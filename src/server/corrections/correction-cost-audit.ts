import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { BreakerAlertPort } from './correction-breaker.js';

/**
 * Attempts whose provider cost never arrived (V4.5-142, quality contract §6).
 *
 * Reports; never writes. An accounting gap on our side must not change what a
 * learner can do with a correction they already received, and a cost inferred
 * to close the books would put a figure in the ledger that describes an
 * inference rather than what was actually spent — the distinction V4.5-101 was
 * about. A human reconciles against the provider's billing from this list.
 */

/**
 * FINISHED — the attempt ended and no cost ever arrived.
 * STUCK_PROCESSING — still marked running long after any lease could be alive,
 * which is not "in flight" but stuck, and its cost is exactly the kind of
 * unknown worth hearing about.
 */
type UnknownCostKind = 'FINISHED' | 'STUCK_PROCESSING';

export interface UnknownCostReport {
  attempts: {
    attemptId: string;
    correctionId: string;
    kind: UnknownCostKind;
    providerRequestId: string | null;
  }[];
  since: Date;
  until: Date;
}

/**
 * Beyond this, a PROCESSING attempt is stuck rather than running. Below it, a
 * missing cost is expected, and alerting on it would fire during healthy
 * operation — an alert that cries wolf costs more than it saves.
 */
const STUCK_PROCESSING_MINUTES = 60;

export class PrismaCorrectionCostAudit {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly alert?: BreakerAlertPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The window the contract names: attempts finished in the last 24 hours. */
  public async report(): Promise<UnknownCostReport> {
    const until = this.now();
    const since = new Date(until.getTime() - 24 * 60 * 60 * 1_000);
    const stuckBefore = new Date(
      until.getTime() - STUCK_PROCESSING_MINUTES * 60 * 1_000,
    );
    const attempts = await this.prisma.aiCorrectionAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        aiCorrectionId: true,
        createdAt: true,
        id: true,
        providerRequestId: true,
        status: true,
      },
      where: {
        costUsd: null,
        createdAt: { gte: since, lte: until },
        OR: [
          { status: { not: 'PROCESSING' } },
          { status: 'PROCESSING', createdAt: { lt: stuckBefore } },
        ],
      },
      take: 200,
    });
    return {
      attempts: attempts.map((attempt) => ({
        attemptId: attempt.id,
        correctionId: attempt.aiCorrectionId,
        kind:
          attempt.status === 'PROCESSING'
            ? ('STUCK_PROCESSING' as const)
            : ('FINISHED' as const),
        providerRequestId: attempt.providerRequestId,
      })),
      since,
      until,
    };
  }

  /**
   * Reports and, when there is anything to report, tells the owner. Identifiers
   * only: an alert about money must not carry the text that was corrected.
   */
  public async reportAndAlert(): Promise<UnknownCostReport> {
    const report = await this.report();
    if (report.attempts.length === 0 || !this.alert) return report;
    await this.alert.send({
      facts: [
        `Tentatives sans coût fournisseur : ${report.attempts.length}`,
        `Fenêtre : ${report.since.toISOString()} → ${report.until.toISOString()}`,
        ...report.attempts
          .slice(0, 20)
          .map(
            (attempt) =>
              `${attempt.kind} · correction ${attempt.correctionId} · tentative ${attempt.attemptId} · fournisseur ${attempt.providerRequestId ?? 'inconnu'}`,
          ),
        'Rapprocher avec la facturation OpenRouter. Aucune écriture automatique.',
      ],
      headline: 'coûts fournisseur manquants sur 24 h',
      idempotencyKey: `unknown-cost-${report.until.toISOString().slice(0, 13)}`,
    });
    return report;
  }
}

/**
 * The exit code a scheduled audit should end on.
 *
 * Findings alone are not a failure — an unknown cost is news, not a broken job.
 * Findings with nowhere to send them are: the scheduler is then the only thing
 * that can tell anyone, and it can only do that by going red.
 */
export function costAuditExitCode(input: {
  attempts: number;
  hasAlertChannel: boolean;
}): 0 | 1 {
  if (input.attempts === 0) return 0;
  return input.hasAlertChannel ? 0 : 1;
}
